'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="empty"><h1>Facciamo un piccolo respiro.</h1><p>La pagina non è stata caricata correttamente. I dati già salvati sul server restano nel tuo account.</p><button className="button primary" onClick={reset}>Riprova</button></main>;
}
