import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFile, readdir } from 'node:fs/promises';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
let pg: PGlite;

async function asUser(id: string) {
  await pg.exec('reset role');
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await pg.exec('set role authenticated');
}

beforeAll(async () => {
  pg = new PGlite({ extensions: { vector, pg_trgm } });
  await pg.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,storage,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated,anon;
    insert into auth.users(id) values('${USER_A}'),('${USER_B}');
  `);
  const migrations = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter(f => f.endsWith('.sql')).sort()) {
    await pg.exec(await readFile(new URL(file, migrations), 'utf8'));
  }
  await pg.exec('grant usage on schema extensions to authenticated');
});

afterAll(async () => {
  await pg?.close();
});

describe('Isole dinamiche ed emergenti (Inside Out)', () => {
  it('isola i dati tra utenti: A non vede le isole o i distretti di B', async () => {
    await asUser(USER_A);
    const islandA = (
      await pg.query<{ id: string }>(
        "insert into myai_islands(name, slug, color, theme, description) values('Storia & Civiltà', 'storia', '#b67b69', 'ancient', 'Civiltà e battaglie') returning id"
      )
    ).rows[0];

    const districtA = (
      await pg.query<{ id: string }>(
        "insert into myai_island_districts(island_id, name, summary) values($1, 'Epoca Napoleonica', 'Napoleone e Waterloo') returning id",
        [islandA.id]
      )
    ).rows[0];

    expect(islandA.id).toBeDefined();
    expect(districtA.id).toBeDefined();

    // Utente B verifica RLS
    await asUser(USER_B);
    const islandsB = (await pg.query('select * from myai_islands')).rows;
    const districtsB = (await pg.query('select * from myai_island_districts')).rows;

    expect(islandsB).toEqual([]);
    expect(districtsB).toEqual([]);

    // Utente B non può inserire distretti su un'isola di A
    await expect(
      pg.query(
        "insert into myai_island_districts(island_id, name, summary) values($1, 'Tentativo Intrusione', 'Test') returning id",
        [islandA.id]
      )
    ).rejects.toThrow();
  });

  it('collega ricordi e conversazioni alle isole e distretti con consolidamento', async () => {
    await asUser(USER_A);
    const island = (
      await pg.query<{ id: string }>("select id from myai_islands where slug='storia'")
    ).rows[0];
    const district = (
      await pg.query<{ id: string }>("select id from myai_island_districts where island_id=$1", [
        island.id,
      ])
    ).rows[0];

    const conv = (
      await pg.query<{ id: string }>(
        "insert into myai_conversations(title, category, island_id, district_id) values('Waterloo', 'capire', $1, $2) returning id",
        [island.id, district.id]
      )
    ).rows[0];

    const memory = (
      await pg.query<{ id: string }>(
        "insert into myai_memories(title, category, kind, content, island_id, district_id, consolidated) values('La ritirata di Russia', 'capire', 'discovery', 'Strategie di Napoleone', $1, $2, true) returning id",
        [island.id, district.id]
      )
    ).rows[0];

    expect(conv.id).toBeDefined();
    expect(memory.id).toBeDefined();

    const memRow = (
      await pg.query<{ island_id: string; district_id: string; consolidated: boolean }>(
        'select island_id, district_id, consolidated from myai_memories where id=$1',
        [memory.id]
      )
    ).rows[0];

    expect(memRow.island_id).toBe(island.id);
    expect(memRow.district_id).toBe(district.id);
    expect(memRow.consolidated).toBe(true);
  });

  it('eliminare un’isola cancella i suoi distretti a cascata e pulisce i puntatori dei ricordi', async () => {
    await asUser(USER_A);
    const island = (
      await pg.query<{ id: string }>("select id from myai_islands where slug='storia'")
    ).rows[0];

    await pg.query('delete from myai_islands where id=$1', [island.id]);

    const districts = (
      await pg.query('select * from myai_island_districts where island_id=$1', [island.id])
    ).rows;
    expect(districts).toEqual([]);

    const memories = (
      await pg.query<{ island_id: string | null; district_id: string | null }>(
        "select island_id, district_id from myai_memories where title='La ritirata di Russia'"
      )
    ).rows[0];
    expect(memories.island_id).toBeNull();
    expect(memories.district_id).toBeNull();
  });
});
