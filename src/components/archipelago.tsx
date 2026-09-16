import { ArrowRight, Compass, List, MessageCircle, Sparkles, MapPin } from 'lucide-react';
import type { Bootstrap, Category, Island as IslandModel } from '@/lib/domain';
import { Island } from './island';

export function Archipelago({
  data,
  category,
  selectedIslandId,
  disabled,
  onChat,
  onOpen,
  onList,
  onConsolidate,
  isConsolidating = false,
}: {
  data: Bootstrap;
  category: Category | null;
  selectedIslandId?: string | null;
  disabled: boolean;
  onChat: (category: Category | null, islandId?: string | null) => void;
  onOpen: (category: Category | null, islandId?: string | null) => void;
  onList: () => void;
  onConsolidate?: () => Promise<void> | void;
  isConsolidating?: boolean;
}) {
  const illustrated = data.preferences.island_view === 'illustrated';
  const islands = data.islands || [];
  const districts = data.districts || [];
  const unconsolidatedCount = data.memories.filter(m => !m.consolidated).length;

  return (
    <section className="archipelago-section" aria-labelledby="islands-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MEMORIA VIVA · ISPIRATA A INSIDE OUT</p>
          <h1 id="islands-title">Il tuo Arcipelago della Mente</h1>
          <p>
            {islands.length === 0
              ? 'Un mare aperto e calmo. Le isole nascono ed evolvono man mano che esplori il mondo.'
              : 'Isole macro e territori tematici, nutriti dai ricordi e dalle tue conversazioni.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onConsolidate && (
            <button
              className="button ghost small"
              disabled={disabled || isConsolidating || unconsolidatedCount === 0}
              onClick={() => void onConsolidate()}
              title={
                unconsolidatedCount > 0
                  ? `${unconsolidatedCount} ricordi pronti per essere consolidati`
                  : 'Nessun nuovo ricordo da consolidare'
              }
            >
              <Sparkles size={15} />
              {isConsolidating
                ? 'Consolidamento notturno…'
                : unconsolidatedCount > 0
                ? `Consolida (${unconsolidatedCount})`
                : 'Memoria consolidata'}
            </button>
          )}
          <button className="button ghost" disabled={disabled} onClick={onList}>
            <List size={16} />
            Vista elenco
          </button>
        </div>
      </div>

      <div className={illustrated ? 'islands-grid' : 'islands-list'}>
        {/* Chat Libera — La Baia di Partenza */}
        <article className={`island-card category-libera ${!selectedIslandId && category === null ? 'chosen' : ''}`}>
          <button
            className="island-open"
            disabled={disabled}
            aria-label="Apri l’isola Chat libera"
            onClick={() => onChat(null, null)}
          >
            {illustrated && <Island category="libera" />}
            <div className="island-card-title">
              <span className="island-icon">
                <MessageCircle size={17} />
              </span>
              <h2>Chat libera</h2>
              <ArrowRight size={17} />
            </div>
            <p>La baia aperta per ogni spunto o pensiero iniziale</p>
            <span className="island-count">Senza filtri o argomenti prefissati</span>
          </button>
          <button
            className="island-context"
            disabled={disabled}
            aria-label="Parliamone in chat · Chat libera"
            aria-controls="chat-workspace"
            onClick={() => onChat(null, null)}
          >
            <MessageCircle size={16} />
            Parliamone in chat
            <ArrowRight size={16} />
          </button>
        </article>

        {/* Isole Dinamiche dell'Utente */}
        {islands.map((isl: IslandModel) => {
          const islandDistricts = districts.filter(d => d.island_id === isl.id);
          const memCount = data.memories.filter(m => m.island_id === isl.id).length;
          const docCount = data.documents.filter(d => d.island_id === isl.id && d.scope === 'memory').length;
          const totalContent = memCount + docCount;
          const isSelected = selectedIslandId === isl.id;

          return (
            <article
              className={`island-card dynamic-island ${isSelected ? 'chosen' : ''}`}
              key={isl.id}
              style={{ borderColor: isSelected ? isl.color : undefined }}
            >
              <button
                className="island-open"
                disabled={disabled}
                onClick={() => onOpen(null, isl.id)}
                aria-label={`Apri l’isola ${isl.name}, ${totalContent} contenuti, ${islandDistricts.length} territori`}
              >
                {illustrated && <Island island={isl} count={totalContent} />}
                <div className="island-card-title">
                  <span className="island-icon" style={{ color: isl.color }}>
                    <Compass size={17} />
                  </span>
                  <h2>{isl.name}</h2>
                  <ArrowRight size={17} />
                </div>
                <p>{isl.description || 'Una grande terra emersa dalle tue conversazioni'}</p>

                {/* Territori / Distretti interni */}
                {islandDistricts.length > 0 && (
                  <div className="districts-preview" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '6px 0' }}>
                    {islandDistricts.slice(0, 3).map(dist => (
                      <span
                        key={dist.id}
                        className="badge small"
                        style={{ fontSize: '11px', padding: '2px 6px', background: 'rgba(0,0,0,0.05)' }}
                      >
                        <MapPin size={10} style={{ marginRight: '3px' }} />
                        {dist.name}
                      </span>
                    ))}
                    {islandDistricts.length > 3 && (
                      <span className="badge small" style={{ fontSize: '10px' }}>
                        +{islandDistricts.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <span className="island-count">
                  {totalContent === 0
                    ? 'Un’isola appena sorta'
                    : `${totalContent} ${totalContent === 1 ? 'ricordo' : 'ricordi'} · ${
                        islandDistricts.length
                      } ${islandDistricts.length === 1 ? 'territorio' : 'territori'}`}
                </span>
              </button>

              <button
                className="island-context"
                disabled={disabled}
                aria-label={`Parliamone in chat · ${isl.name}`}
                aria-controls="chat-workspace"
                onClick={() => onChat(null, isl.id)}
              >
                <MessageCircle size={16} />
                Parliamone in quest’isola
                <ArrowRight size={16} />
              </button>
            </article>
          );
        })}
      </div>

      {islands.length === 0 && (
        <div className="archipelago-empty-note" style={{ textAlign: 'center', padding: '16px 20px', margin: '20px auto', maxWidth: '640px', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px dashed var(--border, #c5b79d)' }}>
          <Compass size={24} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
          <h3 style={{ margin: '0 0 6px', fontSize: '15px' }}>Nessuna isola ancora emersa</h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted, #6d6252)' }}>
            Fai domande ed esplora argomenti nella chat libera. Di sera, la rielaborazione notturna
            farà sorgere automaticamente le tue Isole Macro con i rispettivi sotto-argomenti.
          </p>
          {unconsolidatedCount > 0 && onConsolidate && (
            <button
              className="button primary small"
              style={{ marginTop: '12px' }}
              disabled={disabled || isConsolidating}
              onClick={() => void onConsolidate()}
            >
              <Sparkles size={14} /> Fai emergere le isole dai ricordi di oggi ({unconsolidatedCount})
            </button>
          )}
        </div>
      )}

      <p className="archipelago-note">
        Le isole crescono e memorizzano le tue preferenze nel tempo. La sera la mente dell’app si
        riposa e consolida i ricordi.
      </p>
    </section>
  );
}
