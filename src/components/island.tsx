import { useId } from 'react';
import type { Category } from '@/lib/domain';

export function Island({ category, count = 0 }: { category: Category | 'libera'; count?: number }) {
  const id = useId().replaceAll(':', '');
  const colors = { scrivere: ['#debd90','#a9bba1'], cucinare: ['#adbf8e','#799775'], capire: ['#b5c2d3','#9fb7a8'], desideri: ['#deb6a0','#b4bc91'], libera: ['#bcd4c1','#a7bea6'] }[category];
  const tree = (x: number, y: number, s = 1) => <g transform={`translate(${x} ${y}) scale(${s})`}><path d="M0 0v31" stroke="#806b50" strokeWidth="3"/><ellipse cy="-3" rx="15" ry="21" fill="#8ba483"/><ellipse cx="-4" cy="-8" rx="9" ry="13" fill="#a7bc97"/></g>;
  return <svg className="island-art" viewBox="0 0 320 210" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-land`} x1="160" y1="105" x2="160" y2="190" gradientUnits="userSpaceOnUse"><stop stopColor="#d9c7a7"/><stop offset="1" stopColor="#b29b7c"/></linearGradient>
      <radialGradient id={`${id}-halo`}><stop stopColor={colors[0]} stopOpacity=".35"/><stop offset="1" stopColor={colors[0]} stopOpacity="0"/></radialGradient>
      <filter id={`${id}-shadow`} x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <ellipse cx="160" cy="115" rx="154" ry="93" fill={`url(#${id}-halo)`}/>
    <ellipse cx="164" cy="185" rx="96" ry="10" fill="#8c9c90" opacity=".16" filter={`url(#${id}-shadow)`}/>
    <path d="M40 142c13-34 63-52 124-50 48 1 99 11 116 44l-20 28-25 10-22 13-42 8-49-9-35-8-28-19z" fill={`url(#${id}-land)`}/>
    <path d="M40 139c7-26 55-51 124-48 57 2 103 18 116 44-8 17-45 32-99 36-68 3-123-11-141-32z" fill={colors[1]}/>
    <path d="m75 158 9 15m29-8 3 16m82-10-4 17m46-27-6 17" stroke="#a38e72" strokeWidth="2" opacity=".6"/>
    <path d="M49 192c30 6 56 8 78 7m71 1c30-2 57-7 74-15M33 176l17 4m226-14 17-4" stroke="#b6c7c3" strokeWidth="1.5" strokeLinecap="round"/>
    {category === 'libera' && <>
      {tree(77,106,.95)}{tree(247,101,.85)}
      <ellipse cx="160" cy="145" rx="60" ry="20" fill="#e6d9b9"/>
      <path d="M113 107v34m0-22 29 9v26m-29-18 29 10M181 125v29m0-18 28-12v-23m-28 47 28-12" stroke="#91795c" strokeWidth="6" strokeLinecap="round"/>
      <path d="m116 127 25 8m42-1 23-9" stroke="#f2e7d0" strokeWidth="8" strokeLinecap="round"/>
      <path d="M162 133v24" stroke="#9b8566" strokeWidth="5"/>
      <ellipse cx="162" cy="131" rx="19" ry="9" fill="#c5ac82"/>
      <path d="M120 52h49a10 10 0 0 1 10 10v21a10 10 0 0 1-10 10h-26l-14 13V93h-9a10 10 0 0 1-10-10V62a10 10 0 0 1 10-10Z" fill="#f7f2df" stroke="#c8d2b9" strokeWidth="2"/>
      <path d="M184 75h30a9 9 0 0 1 9 9v15a9 9 0 0 1-9 9h-4v10l-13-10h-13a9 9 0 0 1-9-9V84a9 9 0 0 1 9-9Z" fill="#819b84"/>
      <circle cx="130" cy="72" r="3" fill="#9baf91"/><circle cx="145" cy="72" r="3" fill="#9baf91"/><circle cx="160" cy="72" r="3" fill="#9baf91"/>
      <path d="M188 88h22m-22 9h15" stroke="#ecf0dd" strokeWidth="3" strokeLinecap="round"/>
    </>}
    {category === 'scrivere' && <>
      {tree(80,105,.95)}{tree(240,101,.85)}
      <path d="m108 79 52-25 53 29v64l-54 20-51-28z" fill="#e8d9bb"/>
      <path d="m159 97 54-14v64l-54 20z" fill="#cbb999"/>
      <path d="m100 80 60-39 61 40-60 23z" fill="#9c8070"/>
      <path d="m100 80 60-39 1 63z" fill="#b7997c"/>
      <path d="M175 65V41l14 4v27" fill="#ceb899"/>
      <path d="m118 99 28 11v26l-28-11z" fill="#f5eedb"/>
      <path d="m131 104 1 26m-14-18 28 11" stroke="#a48867" strokeWidth="2"/>
      <path d="m176 110 18-6v35l-18 7z" fill="#877b63"/>
      <path d="m94 147 42-13 29 14-40 15z" fill="#f5efdc"/>
      <path d="m125 140 1 15m6-14 17 6m-43 1 13 4" stroke="#bcb49d"/>
      <path d="m140 136 6-22" stroke="#715f4e" strokeWidth="2"/><path d="M146 115q-2-15 10-17-1 16-10 17" fill="#f5f0df"/>
    </>}
    {category === 'cucinare' && <>
      {tree(72,100,.85)}{tree(250,114,.7)}
      <path d="m99 99 60-26 45 25v48l-57 20-48-24z" fill="#f0e4c8"/>
      <path d="m148 119 56-21v48l-57 20z" fill="#dac9a8"/>
      <path d="m93 100 34-41 37-13 48 52-64 23z" fill="#a88169"/>
      <path d="m127 59 37-13 48 52-64 23z" fill="#bc9377"/>
      <path d="m155 66 27 27-28 10-21-30z" fill="#d4ddc0" opacity=".9"/>
      <path d="m145 72 23 27m-31-14 31-13" stroke="#98a580" strokeWidth="2"/>
      <path d="m110 113 25 12v20l-25-12z" fill="#b1bea2"/>
      <path d="m164 129 18-7v24l-18 6z" fill="#8c9676"/>
      <path d="m204 137 28-10 24 11-27 13zM191 150l26-9 24 11-27 13z" fill="#8e795c"/>
      {[0,1,2].map(i => <g key={i}><path d={`M${210+i*9} ${135+i*2}v-12`} stroke="#637f50" strokeWidth="2"/><ellipse cx={207+i*9} cy={123+i*2} rx="5" ry="3" fill="#aac38b"/><ellipse cx={215+i*9} cy={122+i*2} rx="5" ry="3" fill="#819e69"/></g>)}
      <path d="M88 134v13c0 7 17 10 21 3v-12z" fill="#c58e70"/><path d="M94 137v-16m8 17 2-21" stroke="#708e61" strokeWidth="3"/>
      <circle cx="104" cy="116" r="5" fill="#d3a05e"/>
    </>}
    {category === 'capire' && <>
      {tree(77,119,.7)}{tree(243,123,.8)}
      <path d="m112 119 47-20 49 21v32l-48 19-48-22z" fill="#d8d8c9"/>
      <path d="m160 139 48-19v32l-48 19z" fill="#b4bdba"/>
      <path d="M116 119V94a44 44 0 0 1 88 0v26l-44 18z" fill="#c4d1d0"/>
      <path d="M160 53a44 44 0 0 1 44 41v26l-44 18z" fill="#a0b8b7"/>
      <path d="M160 52v56m-40-16c27 13 55 14 83 1" stroke="#e7ebe1" strokeWidth="2"/>
      <path d="m118 117 43 20 43-17" stroke="#8aa2a0" strokeWidth="4"/>
      <path d="m151 88 40-25 12 17-42 24z" fill="#6e8493"/>
      <ellipse cx="198" cy="71" rx="7" ry="12" transform="rotate(-31 198 71)" fill="#bdcbcb"/>
      <ellipse cx="198" cy="71" rx="4" ry="8" transform="rotate(-31 198 71)" fill="#586d7b"/>
      <path d="m171 145 13-5v18l-13 5z" fill="#6d838a"/>
      <path d="m91 146 26-9 18 8-26 10z" fill="#eae2cf"/><path d="m91 150 18 9 26-10v-4l-26 10-18-9z" fill="#9a9f97"/>
      <path d="m231 51 2 6 6 2-6 2-2 6-2-6-6-2 6-2zM88 61l1 4 5 1-5 2-1 4-2-4-4-2 4-1z" fill="#c6ae75"/>
    </>}
    {category === 'desideri' && <>
      {tree(82,112,.8)}{tree(246,103,.95)}
      <path d="M123 167c-37-27 54-25 59-46 5-18-40-11-39-29 0-8 19-13 33-18" stroke="#e9d9b8" strokeWidth="14" strokeLinecap="round"/>
      <path d="m168 91 31-11 29 12v32l-31 10-29-13z" fill="#ecdcc0"/>
      <path d="m163 92 30-30 38 28-34 15z" fill="#be967c"/>
      <path d="m197 105 31-13v32l-31 10z" fill="#d5bea1"/>
      <path d="m207 109 10-4v15l-10 4z" fill="#889582"/>
      <path d="M127 92V47" stroke="#8c7961" strokeWidth="3"/>
      <path d="M129 49c13-9 18 8 36 0v24c-18 8-24-9-36 0z" fill="#c78e76"/>
      <circle cx="154" cy="139" r="6" fill="#91a37e" stroke="#f2e8d4" strokeWidth="3"/>
      <circle cx="151" cy="100" r="5" fill="#b8b78e" stroke="#f2e8d4" strokeWidth="3"/>
      <path d="m91 147 12-5 13 7-12 5z" fill="#d2af8d"/><path d="m104 154 12-5v11l-12 4z" fill="#b9987e"/>
      <path d="m220 48 6-13 5 13 13 4-13 5-5 12-6-12-11-5z" fill="#dbc399" opacity=".8"/>
    </>}
    {[...Array(Math.min(count, 7))].map((_, i) => <g key={i} transform={`translate(${70+i*25} ${150+Math.sin(i*2)*8})`}><path d="M0 3v-7" stroke="#779567"/><circle cy="-6" r="3.5" fill={i%2 ? '#e8cc9d' : '#e2b29b'}/></g>)}
    <path d="M51 82q8-5 15 0m0 0q6-5 12 0" stroke="#8c9a8e" strokeWidth="1.4" strokeLinecap="round" opacity=".7"/>
  </svg>;
}
