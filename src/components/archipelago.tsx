import { ArrowRight, CookingPot, Feather, Flag, List, MessageCircle, Telescope } from 'lucide-react';
import { categories, type Bootstrap, type Category } from '@/lib/domain';
import { Island } from './island';

const icons = { scrivere: Feather, cucinare: CookingPot, capire: Telescope, desideri: Flag };
export function Archipelago({ data, category, disabled, onChat, onOpen, onList }: { data: Bootstrap; category: Category | null; disabled: boolean; onChat: (category: Category | null) => void; onOpen: (category: Category) => void; onList: () => void }) {
  const illustrated = data.preferences.island_view === 'illustrated';
  return <section className="archipelago-section" aria-labelledby="islands-title">
    <div className="section-heading"><div><p className="eyebrow">UN POSTO PER OGNI IDEA, ANCHE QUELLA CHE NON SAI ANCORA</p><h1 id="islands-title">Le tue isole, il tuo mondo.</h1><p>Scegli dove fermarti. Apri i tuoi ricordi o parliamone insieme.</p></div><button className="button ghost" disabled={disabled} onClick={onList}><List size={16}/>Vista elenco</button></div>
    <div className={illustrated ? 'islands-grid' : 'islands-list'}>
      <article className={`island-card category-libera ${category === null ? 'chosen' : ''}`}>
        <button className="island-open" disabled={disabled} aria-label="Apri l’isola Chat libera" onClick={() => onChat(null)}>
          {illustrated && <Island category="libera"/>}
          <div className="island-card-title"><span className="island-icon"><MessageCircle size={17}/></span><h2>Chat libera</h2><ArrowRight size={17}/></div>
          <p>Uno spazio per tutto ciò che hai in mente</p><span className="island-count">Senza un argomento da scegliere</span>
        </button>
        <button className="island-context" disabled={disabled} aria-label="Parliamone in chat · Chat libera" aria-controls="chat-workspace" onClick={() => onChat(null)}><MessageCircle size={16}/>Parliamone in chat<ArrowRight size={16}/></button>
      </article>
      {categories.map(c => {
        const Icon = icons[c.id];
        const count = data.memories.filter(m => m.category === c.id).length + data.documents.filter(d => d.category === c.id && d.scope === 'memory').length + (c.id === 'desideri' ? data.wishes.length : 0);
        return <article className={`island-card category-${c.id} ${category === c.id ? 'chosen' : ''}`} key={c.id}>
          <button className="island-open" disabled={disabled} onClick={() => onOpen(c.id)} aria-label={`Apri l’isola ${c.name}, ${count} contenuti`}>
            {illustrated && <Island category={c.id} count={count}/>}
            <div className="island-card-title"><span className="island-icon"><Icon size={17}/></span><h2>{c.name}</h2><ArrowRight size={17}/></div>
            <p>{c.short}</p><span className="island-count">{count === 0 ? 'Un’isola tutta da scoprire' : `${count} ${count === 1 ? 'contenuto custodito' : 'contenuti custoditi'}`}</span>
          </button>
          <button className="island-context" disabled={disabled} aria-label={`Parliamone in chat · ${c.name}`} aria-controls="chat-workspace" onClick={() => onChat(c.id)}><MessageCircle size={16}/>Parliamone in chat<ArrowRight size={16}/></button>
        </article>;
      })}
    </div>
    <p className="archipelago-note">La chat libera accoglie ogni spunto. Nelle altre quattro isole scegli tu cosa conservare.</p>
  </section>;
}
