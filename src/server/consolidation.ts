import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError, checked } from './core';
import { complete, type AIMessage } from './ai';
import type { Island, IslandDistrict } from '@/lib/domain';

export type ConsolidationResult = {
  consolidatedCount: number;
  newIslands: string[];
  updatedIslands: string[];
  diaryEntry: string;
};

type LLMConsolidationOutput = {
  new_islands?: {
    name: string;
    slug: string;
    description: string;
    color: string;
    icon: string;
    theme: 'ancient' | 'botanical' | 'observatory' | 'workshop' | 'coastal';
    profile_summary: string;
    initial_districts?: { name: string; summary: string }[];
  }[];
  new_districts?: {
    island_slug_or_id: string;
    name: string;
    summary: string;
  }[];
  memory_assignments?: {
    memory_id: string;
    island_slug_or_id: string;
    district_name_or_id?: string;
  }[];
  island_updates?: {
    island_slug_or_id: string;
    profile_summary: string;
    weight_increment: number;
  }[];
  diary_entry?: string;
};

const paletteByTheme = {
  ancient: '#b67b69',
  botanical: '#68866a',
  observatory: '#6c829c',
  workshop: '#9b7551',
  coastal: '#5b828a',
};

export async function consolidateUserMemories(
  client: SupabaseClient,
  userId: string,
  signal?: AbortSignal
): Promise<ConsolidationResult> {
  const [unconsolidatedMemories, existingIslands, existingDistricts] = await Promise.all([
    checked(
      client
        .from('myai_memories')
        .select('id,title,content,auto_conversation_id,created_at')
        .eq('consolidated', false)
        .order('created_at', { ascending: true })
        .limit(40)
    ),
    checked(client.from('myai_islands').select('*').order('created_at', { ascending: true })),
    checked(client.from('myai_island_districts').select('*').order('created_at', { ascending: true })),
  ]);

  if (!unconsolidatedMemories || unconsolidatedMemories.length === 0) {
    return {
      consolidatedCount: 0,
      newIslands: [],
      updatedIslands: [],
      diaryEntry: 'L’arcipelago è rimasto quieto. Nessun nuovo ricordo in attesa di consolidamento.',
    };
  }

  const prompt = `Sei il cartografo della memoria dell'app My ai. Ispirato al film Inside Out, trasformi i pensieri quotidiani dell'utente in un Arcipelago di Isole della Conoscenza.

Ogni Isola è una MACRO-AREA tematica vasta (es. "Storia & Civiltà", "Scienza & Natura", "Cucina & Sapori", "Filosofia & Pensiero", "Tecnologia & Codice", "Viaggi & Culture").
NON creare isole troppo microscopiche: per temi specifici crea invece DISTRETTI (sotto-argomenti) all'interno dell'isola pertinente.
Esempio: se l'utente parla di Napoleone, crea l'Isola "Storia & Civiltà" con il distretto "Epoca Napoleonica".

Isole attuali dell'utente:
${JSON.stringify(
  existingIslands.map((i: Island) => ({
    id: i.id,
    name: i.name,
    slug: i.slug,
    description: i.description,
    profile_summary: i.profile_summary,
    districts: existingDistricts
      .filter((d: IslandDistrict) => d.island_id === i.id)
      .map((d: IslandDistrict) => ({ id: d.id, name: d.name })),
  })),
  null,
  2
)}

Nuovi ricordi da consolidare:
${JSON.stringify(
  unconsolidatedMemories.map((m: { id: string; title: string; content: string }) => ({
    id: m.id,
    title: m.title,
    snippet: m.content.slice(0, 350),
  })),
  null,
  2
)}

Restituisci SOLO un JSON con questo schema:
{
  "new_islands": [
    {
      "name": "Nome Isola",
      "slug": "slug-univoco",
      "description": "Cosa custodisce quest'isola",
      "color": "#hexColor",
      "icon": "Compass|BookOpen|Landmark|Sparkles|Feather|Telescope|CookingPot|Flame|Cpu|Palette",
      "theme": "ancient|botanical|observatory|workshop|coastal",
      "profile_summary": "Cosa l'utente esplora qui e come preferisce approcciarsi al tema",
      "initial_districts": [
        { "name": "Nome Sotto-argomento", "summary": "Breve sintesi" }
      ]
    }
  ],
  "new_districts": [
    {
      "island_slug_or_id": "id o slug dell'isola",
      "name": "Nome Sotto-argomento",
      "summary": "Breve sintesi"
    }
  ],
  "memory_assignments": [
    {
      "memory_id": "id del ricordo",
      "island_slug_or_id": "slug o id dell'isola",
      "district_name_or_id": "nome o id del distretto"
    }
  ],
  "island_updates": [
    {
      "island_slug_or_id": "id o slug",
      "profile_summary": "Sintesi arricchita delle preferenze e scoperte",
      "weight_increment": 1
    }
  ],
  "diary_entry": "Un pensiero elegante in italiano (2-3 frasi) su come è cresciuto l'arcipelago oggi."
}`;

  const messages: AIMessage[] = [
    {
      role: 'system',
      content:
        'Sei un motore di memoria semantica. Rispondi rigorosamente ed esclusivamente con un oggetto JSON valido.',
    },
    { role: 'user', content: prompt },
  ];

  let rawOutput: LLMConsolidationOutput = {};
  try {
    const aiResponse = await complete(messages, userId, signal, true);
    rawOutput = JSON.parse(aiResponse.content) as LLMConsolidationOutput;
  } catch (err) {
    console.error('consolidation_ai_error', err);
    throw new ApiError(502, 'Impossibile completare la rielaborazione della memoria con l’AI.');
  }

  const islandIdMap = new Map<string, string>();
  existingIslands.forEach((i: Island) => {
    islandIdMap.set(i.id, i.id);
    islandIdMap.set(i.slug, i.id);
    islandIdMap.set(i.name.toLowerCase(), i.id);
  });

  const districtIdMap = new Map<string, string>();
  existingDistricts.forEach((d: IslandDistrict) => {
    districtIdMap.set(d.id, d.id);
    districtIdMap.set(`${d.island_id}::${d.name.toLowerCase()}`, d.id);
  });

  const createdIslandNames: string[] = [];
  const updatedIslandNames: string[] = [];

  // 1. Inserimento nuove isole
  if (rawOutput.new_islands && Array.isArray(rawOutput.new_islands)) {
    for (const islandData of rawOutput.new_islands) {
      const slug = (islandData.slug || islandData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
        .slice(0, 80)
        .replace(/^-|-$/g, '');
      const theme = ['ancient', 'botanical', 'observatory', 'workshop', 'coastal'].includes(islandData.theme)
        ? islandData.theme
        : 'ancient';
      const color = islandData.color || paletteByTheme[theme];

      const inserted = await checked(
        client
          .from('myai_islands')
          .insert({
            name: islandData.name.slice(0, 100),
            slug,
            description: (islandData.description || '').slice(0, 1000),
            color,
            icon: (islandData.icon || 'Compass').slice(0, 50),
            theme,
            profile_summary: (islandData.profile_summary || '').slice(0, 4000),
            weight: Math.max(1, (islandData.initial_districts?.length || 1)),
          })
          .select('id,name,slug')
          .single()
      );

      islandIdMap.set(inserted.id, inserted.id);
      islandIdMap.set(inserted.slug, inserted.id);
      islandIdMap.set(inserted.name.toLowerCase(), inserted.id);
      createdIslandNames.push(inserted.name);

      if (islandData.initial_districts && Array.isArray(islandData.initial_districts)) {
        for (const dist of islandData.initial_districts) {
          const insertedDist = await checked(
            client
              .from('myai_island_districts')
              .insert({
                island_id: inserted.id,
                name: dist.name.slice(0, 100),
                summary: (dist.summary || '').slice(0, 2000),
              })
              .select('id,name')
              .single()
          );
          districtIdMap.set(insertedDist.id, insertedDist.id);
          districtIdMap.set(`${inserted.id}::${insertedDist.name.toLowerCase()}`, insertedDist.id);
        }
      }
    }
  }

  // 2. Inserimento nuovi distretti su isole esistenti
  if (rawOutput.new_districts && Array.isArray(rawOutput.new_districts)) {
    for (const dist of rawOutput.new_districts) {
      const islandId = islandIdMap.get(dist.island_slug_or_id) || islandIdMap.get(dist.island_slug_or_id.toLowerCase());
      if (!islandId) continue;
      const insertedDist = await checked(
        client
          .from('myai_island_districts')
          .insert({
            island_id: islandId,
            name: dist.name.slice(0, 100),
            summary: (dist.summary || '').slice(0, 2000),
          })
          .select('id,name')
          .single()
      );
      districtIdMap.set(insertedDist.id, insertedDist.id);
      districtIdMap.set(`${islandId}::${insertedDist.name.toLowerCase()}`, insertedDist.id);
    }
  }

  // 3. Assegnazione ricordi e conversazioni collegate
  const memoryIdList: string[] = [];
  if (rawOutput.memory_assignments && Array.isArray(rawOutput.memory_assignments)) {
    for (const assign of rawOutput.memory_assignments) {
      const islandId = islandIdMap.get(assign.island_slug_or_id) || islandIdMap.get(assign.island_slug_or_id?.toLowerCase?.());
      if (!islandId) continue;

      let districtId: string | null = null;
      if (assign.district_name_or_id) {
        districtId =
          districtIdMap.get(assign.district_name_or_id) ||
          districtIdMap.get(`${islandId}::${assign.district_name_or_id.toLowerCase()}`) ||
          null;
      }

      await checked(
        client
          .from('myai_memories')
          .update({
            island_id: islandId,
            district_id: districtId,
            consolidated: true,
          })
          .eq('id', assign.memory_id)
      );

      memoryIdList.push(assign.memory_id);

      const mem = unconsolidatedMemories.find((m: { id: string; auto_conversation_id?: string | null }) => m.id === assign.memory_id);
      if (mem?.auto_conversation_id) {
        await checked(
          client
            .from('myai_conversations')
            .update({
              island_id: islandId,
              district_id: districtId,
              consolidated: true,
            })
            .eq('id', mem.auto_conversation_id)
        );
      }
    }
  }

  // 4. Marca come consolidati eventuali ricordi non esplicitamente mappati per non bloccare la coda
  const remainingIds = unconsolidatedMemories
    .map((m: { id: string }) => m.id)
    .filter((id: string) => !memoryIdList.includes(id));
  if (remainingIds.length > 0) {
    await checked(
      client
        .from('myai_memories')
        .update({ consolidated: true })
        .in('id', remainingIds)
    );
  }

  // 5. Aggiornamento sintesi e pesi isole
  if (rawOutput.island_updates && Array.isArray(rawOutput.island_updates)) {
    for (const up of rawOutput.island_updates) {
      const islandId = islandIdMap.get(up.island_slug_or_id) || islandIdMap.get(up.island_slug_or_id?.toLowerCase?.());
      if (!islandId) continue;

      const current = existingIslands.find((i: Island) => i.id === islandId);
      const newWeight = (current?.weight || 1) + Math.max(0, up.weight_increment || 1);

      await checked(
        client
          .from('myai_islands')
          .update({
            profile_summary: (up.profile_summary || current?.profile_summary || '').slice(0, 4000),
            weight: newWeight,
            updated_at: new Date().toISOString(),
          })
          .eq('id', islandId)
      );
      if (current) updatedIslandNames.push(current.name);
    }
  }

  return {
    consolidatedCount: unconsolidatedMemories.length,
    newIslands: createdIslandNames,
    updatedIslands: updatedIslandNames,
    diaryEntry:
      rawOutput.diary_entry ||
      `I ricordi del giorno sono stati rielaborati e catalogati nell'arcipelago.`,
  };
}
