import { writeFileSync } from 'node:fs';

// Flat editorial illustrations, authored independently of the volume variant.
// No fixed palette: currentColor + theme variables are inherited by inline SVG.
const accent = 'currentColor';
const ink = 'var(--hero-ink, currentColor)';
const paper = 'var(--hero-paper, white)';
const soft = 'var(--hero-soft, #eef5ff)';
const p = (d, fill='none', stroke=ink, extra='') => `<path d="${d}" fill="${fill}" stroke="${stroke}" ${extra}/>`;
const r = (x,y,w,h,rx=8,fill=paper,stroke=ink,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" ${extra}/>`;
const c = (x,y,rad,fill='none',stroke=ink,extra='') => `<circle cx="${x}" cy="${y}" r="${rad}" fill="${fill}" stroke="${stroke}" ${extra}/>`;
const g = (transform,body,extra='') => `<g transform="${transform}" ${extra}>${body}</g>`;
const line = (d,stroke=accent,extra='') => p(d,'none',stroke,extra);
const plus = (x,y,s=1) => g(`translate(${x} ${y}) scale(${s})`,line('M-8 0 H8 M0 -8 V8',accent,'stroke-width="3"'));
const star = (x,y,s=1) => g(`translate(${x} ${y}) scale(${s})`,p('M0 -12 Q2 -2 12 0 Q2 2 0 12 Q-2 2 -12 0 Q-2 -2 0 -12',accent,'none'));
const check = (x,y,s=1) => g(`translate(${x} ${y}) scale(${s})`,line('M-10 0 L-2 8 L13 -9',accent,'stroke-width="5"'));
const arrow = d => line(d,accent,'stroke-width="4"');
const rows = (x,y,widths,stroke=ink,gap=16) => widths.map((w,i)=>line(`M${x} ${y+i*gap} h${w}`,stroke,'stroke-width="4"')).join('');
const bubble = (x,y,w,h,body='',fill=paper) => g(`translate(${x} ${y})`,p(`M12 0 H${w-12} Q${w} 0 ${w} 12 V${h-12} Q${w} ${h} ${w-12} ${h} H28 L12 ${h+13} V${h} Q0 ${h} 0 ${h-12} V12 Q0 0 12 0Z`,fill)+body);
const scenes = {};

// Ads: a stream of noisy announcements passes through a sieve; only a clean post leaves.
scenes.ads = g('translate(62 81) rotate(-8)',r(0,0,78,48,9,soft)+p('M18 19 H33 L49 10 V36 L33 27 H18Z',paper)+line('M23 29 L27 38',ink))
  +g('translate(81 163) rotate(7)',r(0,0,69,48,9,soft)+line('M17 16 L51 33 M51 16 L17 33',ink))
  +line('M145 103 C178 103 169 133 191 139 M153 183 C177 183 170 159 191 151',accent,'stroke-dasharray="5 8" stroke-width="3"')
  +p('M185 87 H286 L256 145 V194 L218 212 V145Z',soft)+line('M197 108 H274 M207 126 H264',accent,'stroke-width="3"')
  +[212,235,258].map(x=>c(x,99,2,accent,'none')).join('')
  +arrow('M276 169 H307 M299 161 L307 169 L299 177')
  +r(320,110,97,89,12)+r(334,124,27,23,4,soft,'none')+rows(335,162,[67,46])+c(392,105,20,paper)+check(392,106,.85)+star(328,69,.65)+plus(174,222,.6);

// appearance-hero.svg is maintained from the corrected Figma paths; do not regenerate it.

// Automation: a readable workflow with a branch and a completed final action.
scenes.automation = line('M141 149 H181 M250 150 H292 M217 112 V82 H300',accent,'stroke-dasharray="6 8" stroke-width="3"')
  +r(71,117,71,65,14,soft)+p('M106 127 L92 151 H105 L100 173 L124 144 H110Z',accent,'none')
  +g('translate(217 150) rotate(45)',r(-27,-27,54,54,9))+g('translate(217 150)',c(0,0,10,soft)+line('M-14 0 H14 M0 -14 V14',accent,'stroke-width="2"'))
  +r(299,115,101,71,12)+check(349,150,1.3)+r(304,58,75,41,9,soft)+line('M323 78 H357',ink)
  +line('M218 190 V220 H325',ink,'stroke-width="3"')+c(337,220,12,soft)+line('M337 214 V220 L342 223',ink,'stroke-width="3"')+star(145,71,.8)+plus(397,220,.7)+c(65,205,5,accent,'none');

// center-hero.svg is maintained from the corrected Figma paths; do not regenerate it.

// CSS: a bracket frame around a live design, with a code cursor and typography.
scenes.css = r(127,71,231,159,15)+line('M128 100 H357',accent,'stroke-width="3"')+[145,156,167].map(x=>c(x,86,2.5,accent,'none')).join('')
  +r(146,118,67,91,7,soft,'none')+p('M161 142 L173 130 L199 160 H151Z',accent,'none','opacity=".35"')+rows(155,179,[48,33],ink,12)
  +line('M238 131 L225 145 L238 159 M280 131 L293 145 L280 159 M265 126 L251 166',accent,'stroke-width="5"')
  +rows(231,187,[62,92],ink,14)+r(331,180,8,22,2,accent,'none')
  +line('M103 108 H89 Q76 108 76 123 V140 Q76 150 64 150 Q76 150 76 160 V177 Q76 192 89 192 H103 M380 108 H393 Q406 108 406 123 V140 Q406 150 418 150 Q406 150 406 160 V177 Q406 192 393 192 H380',accent,'stroke-width="5"')
  +star(330,47,.6)+plus(112,248,.6);

// hiding-hero.svg is maintained from the corrected Figma paths; do not regenerate it.

// More: a toolkit tray with a wrench, a dial, and switches rather than a control console.
scenes.more = p('M116 126 H372 L389 228 H101Z',soft)+r(100,209,289,32,10)+line('M155 227 H335',ink,'stroke-width="3"')
  +g('translate(169 145) rotate(-25)',p('M-11 61 V-26 C-33 -37 -31 -61 -15 -72 V-44 L0 -35 L15 -44 V-72 C31 -61 33 -37 11 -26 V61Z',paper)+c(0,47,5,soft))
  +c(271,118,42,paper)+line('M243 137 A32 32 0 0 1 299 137',accent,'stroke-width="6"')+line('M271 127 L286 108',ink,'stroke-width="4"')+c(271,127,4,accent,'none')
  +g('translate(346 159) rotate(12)',r(-25,-61,50,110,10,paper)+line('M0 -43 V30',ink,'stroke-width="3"')+r(-14,-23,28,18,5,accent,'none')+r(-14,12,28,18,5,soft))
  +star(100,77,.8)+plus(401,120,.7)+c(265,190,5,accent,'none');

// Notes: a saved conversation snippet, a paper tab, and a small handwritten thought.
scenes.notes = bubble(88,116,172,102,rows(19,29,[114,133,87],ink,20),soft)
  +g('translate(279 67) rotate(8)',r(0,0,119,155,12)+rows(18,64,[82,64,79],ink,21)+p('M75 0 H100 V47 L88 37 L75 47Z',accent,'none')+line('M20 126 Q32 108 43 127 T67 123',accent,'stroke-width="3"'))
  +c(123,99,21,paper)+check(123,100,.9)+star(238,74,.8)+plus(419,236,.6)+line('M93 255 H173',accent,'stroke-width="2" stroke-dasharray="3 7"');

// Privacy: symmetric envelope folds, an evenly dashed ring, and a readable enabled switch.
scenes.privacy = c(241,146,92,soft,'none')
  +c(241,146,92,'none',accent,'stroke-width="3" pathLength="360" stroke-dasharray="9 9" stroke-dashoffset="4.5"')
  +r(168,96,146,100,12)
  +line('M174 188 L219 135 M308 188 L263 135',accent,'stroke-width="3"')
  +p('M174 102 L234 146 Q241 151 248 146 L308 102',paper,accent,'stroke-width="4"')
  +r(296,166,96,50,25,paper)+c(367,191,17,accent,'none')
  +line('M359 191 L365 197 L375 185',paper,'stroke-width="3.5"')
  +c(115,96,29,paper)+c(115,84,7,soft)
  +p('M100 112 V110 C100 103 106 99 115 99 C124 99 130 103 130 110 V112Z',soft)
  +line('M137 123 L157 142',ink,'stroke-width="3" stroke-dasharray="3 7"')
  +star(360,85,.8)+plus(139,221,.7)+c(409,144,5,accent,'none');

// Spy: an activity timeline and magnifying glass, instead of a radar screen.
scenes.spy = line('M94 152 H368',ink,'stroke-width="3"')+[114,184,258,344].map((x,i)=>c(x,152,i===2?10:7,paper)).join('')
  +line('M114 144 V110 M184 160 V204 M258 140 V89 M344 160 V206',accent,'stroke-width="3" stroke-dasharray="4 6"')
  +bubble(79,63,92,40,rows(14,16,[62,43],ink,11),soft)+r(153,201,71,42,8,soft)+line('M168 221 H181 L185 211 L190 229 L195 216 H209',accent,'stroke-width="3"')
  +c(298,107,44,paper)+c(298,107,32,soft,'none')+line('M329 139 L365 175',accent,'stroke-width="12"')+line('M280 111 H290 L297 94 L306 121 L313 106 H321',accent,'stroke-width="3"')
  +c(344,221,16,soft)+check(344,222,.6)+star(197,81,.6)+plus(393,84,.7);

// widgets-hero.svg is maintained from the corrected Figma paths; do not regenerate it.

for (const [name,scene] of Object.entries(scenes)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300" preserveAspectRatio="xMaxYMid meet" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M103 100 C119 49 196 39 263 47 C333 54 411 90 407 158 C403 221 341 267 267 254 C190 241 86 254 78 198 C72 154 85 133 103 100Z" fill="currentColor" stroke="none" opacity=".06"/>${scene}</svg>\n`;
  writeFileSync(`src/popup/artwork/flat/${name}-hero.svg`,svg);
}
