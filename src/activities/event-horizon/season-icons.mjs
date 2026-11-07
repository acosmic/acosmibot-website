// Lucide icon outlines (ISC), inlined because the Activity does not use React.
// Each season button shows its icon instead of a plain colour dot.
const ICONS={
  classic:[['path',{d:'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5'}],['path',{d:'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09'}],['path',{d:'M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z'}],['path',{d:'M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05'}]],
  halloween:[['path',{d:'M9 10h.01'}],['path',{d:'M15 10h.01'}],['path',{d:'M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z'}]],
  thanksgiving:[['path',{d:'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z'}],['path',{d:'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'}]],
  christmas:[['path',{d:'m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z'}],['path',{d:'M12 22v-3'}]],
};
const SVG='http://www.w3.org/2000/svg';
export const hasSeasonIcon=id=>Object.hasOwn(ICONS,id);
export function seasonIcon(id,doc=document){
  const svg=doc.createElementNS(SVG,'svg');
  for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(key,value);
  svg.classList.add('season-icon');
  for(const [tag,attributes] of ICONS[id]??ICONS.classic){const node=doc.createElementNS(SVG,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);svg.append(node);}
  return svg;
}
