// Builds hsk.js and strokes/h*.json for the HSK 3.0 curriculum.
// Not part of the app. Run with Node 18+ from the repo root:
//   node tools/build-hsk.js [cache-dir]
// Sources are pinned so the output is reproducible. Downloads are cached in cache-dir
// (default: tools/.cache, which is not needed by the app and can be deleted).
'use strict';
const fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CACHE = path.resolve(process.argv[2] || path.join(__dirname, '.cache'));
const HSK_SHA = '6d52713bac89a74917a26363e1963be1c79d2265'; // krmanik/HSK-3.0, 2025 syllabus with 30 Oct 2026 pinyin revision
const LEVELS = ['1', '2', '3', '4', '5', '6', '7-9'];
const SRC = {
  ...Object.fromEntries(LEVELS.map(l => [`hsk${l}.tsv`, `https://raw.githubusercontent.com/krmanik/HSK-3.0/${HSK_SHA}/New%20HSK%20(2025)/Anki%20xiehanzi/HSK_Level_${l}.txt`])),
  'dictionary.txt': 'https://raw.githubusercontent.com/skishore/makemeahanzi/618dbab8a8ddefb958763c8b4afbaa741a4460de/dictionary.txt',
  'all_cedict.json': `https://raw.githubusercontent.com/krmanik/HSK-3.0/${HSK_SHA}/Scripts%20and%20data/all_cedict.json`,
  'STCharacters.txt':'https://raw.githubusercontent.com/BYVoid/OpenCC/178f05dbc5dbcedd09d4ab39d501094f4d9d8820/data/dictionary/STCharacters.txt',
};
const STROKE_URL = c => `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(c)}.json`;
const CHUNK = 200; // characters per strokes/h*.json file

async function get(name){
  const f = path.join(CACHE, name);
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  const url = SRC[name], res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const text = await res.text();
  fs.mkdirSync(CACHE, {recursive: true}); fs.writeFileSync(f, text);
  return text;
}
async function strokes(c){
  const dir = path.join(CACHE, 'strokes'), f = path.join(dir, c.codePointAt(0).toString(16) + '.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let tries = 0; ; tries++){
    try {
      const res = await fetch(STROKE_URL(c));
      if (!res.ok) throw new Error(res.status + ' ' + c);
      const j = await res.json(), out = {strokes: j.strokes, medians: j.medians};
      fs.mkdirSync(dir, {recursive: true}); fs.writeFileSync(f, JSON.stringify(out));
      return out;
    } catch (e){ if (tries >= 3) throw e; await new Promise(r => setTimeout(r, 1000 * (tries + 1))); }
  }
}

/* ---------- text helpers ---------- */
const HAN = /[⺀-⿟㐀-鿿豈-﫿]/;
const decode = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const toneless = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '').replace(/r$/, 'r');
const exact = s => s.normalize('NFC').toLowerCase().replace(/[\s'’\-·0-9]/g, '');
// CC-CEDICT cross references like 跑堂兒的|跑堂儿的[pao3 tang2 r5 de5] -> 跑堂儿的
const unref = s => s.replace(/(?:[^\s\[\]|(),;]+\|)?([^\s\[\]|(),;]+)\[[a-zA-Z0-9 :,]+\]/g, '$1');
const JUNK = /^(surname |\(\w+ surname\)|(old |archaic |erhua |unofficial |ancient |erroneous |Japanese |Taiwan )?variant of |see [^ ]|used in |abbr\. (for|to) |colloquial pr\.|CL:|\(Tw\)|\(old\)|\(dialect\)|\(archaic\)|\(literary\)|\(classical\))/i;
// A sense that only points at another word: "erhua variant of 一点", "see 仿效", "abbr. for 体格检查"
const REF = /^(?:(?:erhua |old |unofficial |erroneous )?variant of|see|abbr\. for) ([^\s(;,]+)/i;
// Tidy one CC-CEDICT sense: drop pronunciation notes and "(abbr. for …)" tails
const tidy = i => i.replace(/\(?\s*(?:also|colloquial|coll\.|old|Taiwan) pr\. \[[^\]]*\][^);]*\)?/gi, '').replace(/;?\s*\(?(also|colloquial) pr\. [^)]*\)?( for this sense)?/gi, '').replace(/\s*\((?:(?:especially as )?abbr\. for|variant of) [^)]*\)/gi, '').trim();
const clean = items => items.map(i => tidy(unref(i))).filter(i => i && !/^[^a-zA-Z]*$/.test(i));
const LONG = 50;

// Up to three short senses, about 48 characters in all
function summarize(items){
  const short = items.filter(i => i.length <= LONG);
  if (short.length) items = short;
  const out = [];
  for (const i of items){
    if (out.length && (out.length >= 3 || out.join('; ').length + i.length > 48)) break;
    out.push(i.length > 70 ? i.slice(0, 67).replace(/[\s,;]+\S*$/, '') + '…' : i);
  }
  return out.join('; ');
}
function blocksOf(html){
  return [...html.matchAll(/<span class="pinYinWrapper">(.*?)<\/span>\s*<ul>(.*?)<\/ul>/g)]
    .map(m => ({py: decode(m[1]), items: clean([...m[2].matchAll(/<li>(.*?)<\/li>/g)].map(x => decode(x[1])))}));
}
// Returns {text} or, when the matching reading only points at another word, {see: that word}
function pickMeaning(word, html, py){
  const blocks = blocksOf(html);
  if (!blocks.length) return {text: ''};
  const want = py.split('/')[0].trim();
  const score = b => (b.py.replace(/\s/g, '') === want.replace(/\s/g, '') ? 1 : 0) + (exact(b.py) === exact(want) ? 4 : toneless(b.py) === toneless(want) ? 2 : 0);
  const useful = b => b.items.some(i => !JUNK.test(i));
  let best = blocks[0], bs = -1;
  for (const b of blocks){ const s = score(b) * 2 + (useful(b) ? 1 : 0); if (s > bs){ best = b; bs = s; } }
  let items = best.items.filter(i => !JUNK.test(i));
  if (!items.length){
    const ref = best.items.map(i => i.match(REF)).find(m => m && m[1] !== word);
    if (ref) return {see: ref[1]};
    // e.g. 血 xiě is only "see 血 xuè": borrow the closest reading that has a real meaning
    const alt = blocks.filter(b => b !== best && useful(b)).sort((a, b) => score(b) - score(a))[0];
    items = alt ? alt.items.filter(i => !JUNK.test(i)) : best.items.filter(i => !REF.test(i));
    if (!items.length) items = best.items;
  }
  return {text: summarize(items)};
}

/* ---------- character origins (same shape as data.js) ---------- */
function makeOrigin(dict, known, trad){
  const firstSense = d => (d || '').split(';')[0].trim();
  const shortDef = d => { const s = firstSense(d); return s.length > 28 ? s.slice(0, 28) : s; };
  const part = c => known.pa.get(c) || [c, (dict.get(c)?.pinyin || [''])[0] || '', shortDef(dict.get(c)?.definition)];
  const radName = c => known.r.get(c) || shortDef(dict.get(c)?.definition);
  return c => {
    const d = dict.get(c); if (!d) return null;
    const o = {}, e = d.etymology;
    if (e && e.type === 'pictophonetic'){
      o.t = 's';
      if (e.semantic) o.sm = [e.semantic, e.hint || radName(e.semantic)];
      if (e.phonetic) o.ph = [e.phonetic, (dict.get(e.phonetic)?.pinyin || [''])[0] || ''];
    } else if (e && (e.type === 'ideographic' || e.type === 'pictographic') && e.hint){
      o.t = e.type === 'ideographic' ? 'i' : 'p'; o.h = e.hint.normalize('NFKC').trim();
    }
    // Immediate components; an unknown slot (？) is filled from the etymology's phonetic/semantic part
    const dec = [...(d.decomposition || '')];
    const fill = [e?.phonetic, e?.semantic].filter(x => x && !dec.includes(x));
    const kids = [...new Set(dec.filter(x => !/[⿰-⿿]/.test(x)).map(x => x === '？' ? fill.shift() : x).filter(Boolean))];
    const guess = dec.includes('？') && o.t === 'p'; // a picture with an unknown piece: listed parts would mislead
    if (!guess && kids.length && !(kids.length === 1 && kids[0] === c)) o.pa = kids.map(part);
    if (d.radical && d.radical !== c) o.r = [d.radical, radName(d.radical)];
    const t = trad.get(c); if (t && !t.includes(c)) o.tr = t.join(' / ');
    return o;
  };
}

(async () => {
  global.window = {};
  eval(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'));
  const FREQ = window.HANZI, inFreq = new Map(FREQ.map((w, i) => [w[0], i]));
  const known = {pa: new Map(), r: new Map()};
  for (const w of FREQ){ for (const p of w[3]?.pa || []) known.pa.set(p[0], p); if (w[3]?.r) known.r.set(w[3].r[0], w[3].r[1]); }

  const dict = new Map((await get('dictionary.txt')).split('\n').filter(Boolean).map(l => { const o = JSON.parse(l); return [o.character, o]; }));
  const trad = new Map((await get('STCharacters.txt')).split(/\r?\n/).filter(l => l.includes('\t')).map(l => { const [s, t] = l.split('\t'); return [s, t.trim().split(/\s+/)]; }));
  const origin = makeOrigin(dict, known, trad);

  // How close is the derivation to the hand-checked data.js? (data.js also has 113 hand-written notes.)
  let same = 0, total = 0;
  for (const w of FREQ){
    if (w[3].t === 'n') continue; total++;
    const a = JSON.stringify(origin(w[0])), b = JSON.stringify(w[3]);
    if (a === b) same++; else if (process.env.DIFF) console.log(w[0] + '\n  got  ' + a + '\n  want ' + b);
  }
  console.log(`origin derivation matches data.js for ${same}/${total} characters`);

  const words = [], levels = [], pending = [];
  for (const L of LEVELS){
    const rows = (await get(`hsk${L}.tsv`)).split(/\r?\n/).filter(Boolean).map(l => l.split('\t'));
    const start = words.length + 1;
    for (const r of rows){
      const [w, , py, , lv] = r;
      // Homographs list every level they appear at, e.g. 好 "1（2）（4）"
      if (!lv.split(/[（）()]/).includes(L)) throw new Error(`level mismatch ${w} ${lv} ${L}`);
      if (![...w].every(c => HAN.test(c))) throw new Error('non-Han word ' + w);
      const m = pickMeaning(w, r[7], py);
      words.push([w, py.trim(), m.text]);
      if (m.see) pending.push([words.length - 1, m.see]);
      else if (!m.text) throw new Error('no meaning ' + w);
    }
    levels.push([`HSK ${L.replace('-', '–')}`, start, words.length]);
  }
  // "erhua variant of 一点", "see 仿效": use the meaning of the word it points at, from this list or CC-CEDICT
  const cedict = JSON.parse(await get('all_cedict.json'));
  const lookup = (base, depth = 0) => {
    const hit = words.find(x => x[0] === base && x[2]);
    if (hit) return hit[2];
    const e = cedict[base]; if (!e) return '';
    const items = clean(Object.values(e.definitions)[0].split(/;\s*/));
    const good = items.filter(i => !JUNK.test(i));
    if (good.length) return summarize(good);
    const ref = items.map(i => i.match(REF)).find(m => m && m[1] !== base);
    return ref && depth < 2 ? lookup(ref[1], depth + 1) : '';
  };
  for (const [i, base] of pending){
    words[i][2] = lookup(base);
    if (!words[i][2]) throw new Error(`no meaning for ${words[i][0]} (points at ${base})`);
  }

  // Characters the 1,000 list doesn't cover, in order of first appearance
  const extra = [];
  for (const [w] of words) for (const c of w) if (!inFreq.has(c) && !extra.includes(c)) extra.push(c);
  const chars = {};
  for (const c of extra){
    const single = words.find(x => x[0] === c), d = dict.get(c);
    const py = single ? single[1].split('/')[0] : (d.pinyin || [''])[0];
    let gl = single ? single[2] : (d.definition || '').split(';').slice(0, 2).join(';').trim();
    if (gl.length > 48) gl = gl.slice(0, 46).replace(/[\s,;]+\S*$/, '') + '…';
    chars[c] = [py, gl, origin(c)];
  }
  const noEty = extra.filter(c => !chars[c][2].t);
  console.log(`${words.length} words, ${extra.length} new characters (${noEty.length} without an origin note)`);

  const out = `/* HSK 3.0 vocabulary, examination syllabus published Nov 2025 (basis of the HSK 3.0 exam from 13 Dec 2026).
   Word list and pinyin: krmanik/HSK-3.0 @ ${HSK_SHA.slice(0, 7)} (CC BY-SA 4.0). Meanings: CC-CEDICT (CC BY-SA 4.0).
   Character origins: Make Me a Hanzi (LGPL). Traditional forms: OpenCC (Apache 2.0). Generated by tools/build-hsk.js. */
window.HSK=${JSON.stringify({levels, words, chars, strokes: extra.join('')})};\n`;
  fs.writeFileSync(path.join(ROOT, 'hsk.js'), out);
  console.log('hsk.js', (out.length / 1024).toFixed(0) + ' KB');

  // Stroke data for the new characters, 200 per file
  const all = []; let next = 0;
  const work = async () => { while (next < extra.length){ const i = next++; all[i] = await strokes(extra[i]); } };
  await Promise.all(Array.from({length: 12}, work));
  const files = [];
  for (let k = 0; k * CHUNK < extra.length; k++){
    const o = {}; extra.slice(k * CHUNK, (k + 1) * CHUNK).forEach((c, j) => o[c] = all[k * CHUNK + j]);
    const f = `strokes/h${k}.json`; fs.writeFileSync(path.join(ROOT, f), JSON.stringify(o)); files.push(f);
  }
  console.log('wrote', files.join(' '));
})().catch(e => { console.error(e); process.exit(1); });
