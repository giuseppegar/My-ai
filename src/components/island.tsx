import { useId } from 'react';
import type { Category, Island as IslandModel } from '@/lib/domain';

export function Island({
  category,
  island,
  count = 0,
}: {
  category?: Category | 'libera' | null;
  island?: IslandModel;
  count?: number;
}) {
  const id = useId().replaceAll(':', '');

  const effectiveTheme = island?.theme || (category === 'cucinare' ? 'botanical' : category === 'capire' ? 'observatory' : category === 'scrivere' ? 'workshop' : category === 'desideri' ? 'ancient' : 'coastal');
  
  const themePalettes: Record<string, [string, string]> = {
    ancient: [island?.color || '#deb6a0', '#b4bc91'],
    botanical: [island?.color || '#adbf8e', '#799775'],
    observatory: [island?.color || '#b5c2d3', '#9fb7a8'],
    workshop: [island?.color || '#debd90', '#a9bba1'],
    coastal: [island?.color || '#bcd4c1', '#8ca89d'],
  };

  const defaultCategoryColors: Record<string, [string, string]> = {
    scrivere: ['#debd90', '#a9bba1'],
    cucinare: ['#adbf8e', '#799775'],
    capire: ['#b5c2d3', '#9fb7a8'],
    desideri: ['#deb6a0', '#b4bc91'],
    libera: ['#bcd4c1', '#a7bea6'],
  };

  const colors = category && defaultCategoryColors[category]
    ? defaultCategoryColors[category]
    : themePalettes[effectiveTheme] || ['#bcd4c1', '#a7bea6'];

  const tree = (x: number, y: number, s = 1) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0v31" stroke="#806b50" strokeWidth="3" />
      <ellipse cy="-3" rx="15" ry="21" fill="#8ba483" />
      <ellipse cx="-4" cy="-8" rx="9" ry="13" fill="#a7bc97" />
    </g>
  );

  const districtCount = island?.districts?.length || 0;

  return (
    <svg className="island-art" viewBox="0 0 320 210" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-land`} x1="160" y1="105" x2="160" y2="190" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d9c7a7" />
          <stop offset="1" stopColor="#b29b7c" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop stopColor={colors[0]} stopOpacity=".35" />
          <stop offset="1" stopColor={colors[0]} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* Alone e Ombra sul mare */}
      <ellipse cx="160" cy="115" rx="154" ry="93" fill={`url(#${id}-halo)`} />
      <ellipse cx="164" cy="185" rx="96" ry="10" fill="#8c9c90" opacity=".16" filter={`url(#${id}-shadow)`} />

      {/* Zolla e altopiano dell'isola */}
      <path d="M40 142c13-34 63-52 124-50 48 1 99 11 116 44l-20 28-25 10-22 13-42 8-49-9-35-8-28-19z" fill={`url(#${id}-land)`} />
      <path d="M40 139c7-26 55-51 124-48 57 2 103 18 116 44-8 17-45 32-99 36-68 3-123-11-141-32z" fill={colors[1]} />
      <path d="m75 158 9 15m29-8 3 16m82-10-4 17m46-27-6 17" stroke="#a38e72" strokeWidth="2" opacity=".6" />
      <path d="M49 192c30 6 56 8 78 7m71 1c30-2 57-7 74-15M33 176l17 4m226-14 17-4" stroke="#b6c7c3" strokeWidth="1.5" strokeLinecap="round" />

      {/* Decorazione specifica per tema o categoria */}
      {(category === 'libera' || (!category && effectiveTheme === 'coastal')) && (
        <>
          {tree(77, 106, 0.95)}
          {tree(247, 101, 0.85)}
          <ellipse cx="160" cy="145" rx="60" ry="20" fill="#e6d9b9" />
          <path d="M113 107v34m0-22 29 9v26m-29-18 29 10M181 125v29m0-18 28-12v-23m-28 47 28-12" stroke="#91795c" strokeWidth="6" strokeLinecap="round" />
          <path d="m116 127 25 8m42-1 23-9" stroke="#f2e7d0" strokeWidth="8" strokeLinecap="round" />
          <path d="M162 133v24" stroke="#9b8566" strokeWidth="5" />
          <ellipse cx="162" cy="131" rx="19" ry="9" fill="#c5ac82" />
          {/* Faro / Torretta */}
          <path d="m154 90 4-38h8l4 38z" fill="#ece4d0" stroke="#9b8566" strokeWidth="1.5" />
          <circle cx="162" cy="48" r="4" fill="#deb969" />
          <path d="M150 48h24" stroke="#ecdcc0" strokeWidth="2" opacity=".7" />
        </>
      )}

      {effectiveTheme === 'ancient' && (
        <>
          {tree(82, 112, 0.8)}
          {tree(246, 103, 0.95)}
          {/* Tempio / Colonne classiche / Monumento storico */}
          <path d="m120 130 40-15 40 15v10l-40 12-40-12z" fill="#e8d9bb" />
          <path d="m125 125 35-22 35 22z" fill="#b7997c" stroke="#8c7961" strokeWidth="1.5" />
          <path d="M135 125v16M145 122v17M160 118v19M175 122v17M185 125v16" stroke="#9c8070" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M123 167c-37-27 54-25 59-46 5-18-40-11-39-29 0-8 19-13 33-18" stroke="#e9d9b8" strokeWidth="10" strokeLinecap="round" opacity=".8" />
          <circle cx="154" cy="139" r="6" fill="#91a37e" stroke="#f2e8d4" strokeWidth="3" />
        </>
      )}

      {effectiveTheme === 'botanical' && (
        <>
          {tree(72, 100, 0.85)}
          {tree(250, 114, 0.7)}
          <path d="m99 99 60-26 45 25v48l-57 20-48-24z" fill="#f0e4c8" />
          <path d="m148 119 56-21v48l-57 20z" fill="#dac9a8" />
          <path d="m93 100 34-41 37-13 48 52-64 23z" fill="#a88169" />
          <path d="m155 66 27 27-28 10-21-30z" fill="#d4ddc0" opacity=".9" />
          {[0, 1, 2].map(i => (
            <g key={i}>
              <path d={`M${210 + i * 9} ${135 + i * 2}v-12`} stroke="#637f50" strokeWidth="2" />
              <ellipse cx={207 + i * 9} cy={123 + i * 2} rx="5" ry="3" fill="#aac38b" />
              <ellipse cx={215 + i * 9} cy={122 + i * 2} rx="5" ry="3" fill="#819e69" />
            </g>
          ))}
        </>
      )}

      {effectiveTheme === 'observatory' && (
        <>
          {tree(77, 119, 0.7)}
          {tree(243, 123, 0.8)}
          {/* Cupola astronomica e telescopio */}
          <path d="m112 119 47-20 49 21v32l-48 19-48-22z" fill="#d8d8c9" />
          <path d="M116 119V94a44 44 0 0 1 88 0v26l-44 18z" fill="#c4d1d0" />
          <path d="M160 53a44 44 0 0 1 44 41v26l-44 18z" fill="#a0b8b7" />
          <path d="m151 88 40-25 12 17-42 24z" fill="#6e8493" />
          <ellipse cx="198" cy="71" rx="7" ry="12" transform="rotate(-31 198 71)" fill="#bdcbcb" />
          {/* Piccole stelle sul cielo */}
          <path d="m231 51 2 6 6 2-6 2-2 6-2-6-6-2 6-2zM88 61l1 4 5 1-5 2-1 4-2-4-4-2 4-1z" fill="#c6ae75" />
        </>
      )}

      {effectiveTheme === 'workshop' && (
        <>
          {tree(80, 105, 0.95)}
          {tree(240, 101, 0.85)}
          <path d="m108 79 52-25 53 29v64l-54 20-51-28z" fill="#e8d9bb" />
          <path d="m100 80 60-39 61 40-60 23z" fill="#9c8070" />
          <path d="m94 147 42-13 29 14-40 15z" fill="#f5efdc" />
          {/* Penna/Piuma/Bussola */}
          <path d="m140 136 6-22" stroke="#715f4e" strokeWidth="2" />
          <path d="M146 115q-2-15 10-17-1 16-10 17" fill="#f5f0df" />
        </>
      )}

      {/* Distretti / Sotto-argomenti: Bandiere e fari che punteggiano l'isola */}
      {districtCount > 0 &&
        [...Array(Math.min(districtCount, 5))].map((_, i) => {
          const posX = 110 + i * 28;
          const posY = 100 + Math.sin(i * 1.5) * 12;
          return (
            <g key={`district-${i}`} transform={`translate(${posX} ${posY})`}>
              <path d="M0 0v-16" stroke="#6d5843" strokeWidth="2" strokeLinecap="round" />
              <path d="M0 -16l12 4-12 4z" fill={colors[0]} stroke="#6d5843" strokeWidth="1" />
              <circle cx="0" cy="-17" r="1.5" fill="#f5ecd8" />
            </g>
          );
        })}

      {/* Indicatori dei ricordi salvati (piccoli boccioli o luci) */}
      {[...Array(Math.min(count, 7))].map((_, i) => (
        <g key={i} transform={`translate(${70 + i * 25} ${150 + Math.sin(i * 2) * 8})`}>
          <path d="M0 3v-7" stroke="#779567" />
          <circle cy="-6" r="3.5" fill={i % 2 ? '#e8cc9d' : '#e2b29b'} />
        </g>
      ))}

      {/* Onde delicate sul mare */}
      <path d="M51 82q8-5 15 0m0 0q6-5 12 0" stroke="#8c9a8e" strokeWidth="1.4" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}
