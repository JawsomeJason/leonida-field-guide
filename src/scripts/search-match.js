// Plain-sentence search over the loaded index. Pure (no DOM), so a test can import it.
// A query is cut into words; filler words go; each word is folded to a stem (plurals, -ing, -ed),
// console and storage words become synonyms, and one typo is forgiven in words of 5 or more letters.
// Records rank by how many words match, then by where they match: question, keywords, short, topic.
// No library: shortcut: stems are a few suffix rules, not a stemmer; upgrade if real queries miss.

const STOP = new Set(
  `a an the is are was were be am i me my we you your it its do does did how what whats when who which will would can could should
   to of on in at for with and or no if get there this that any have has about from so just much many where thats im ive`.split(/\s+/),
);

// Words players use for the same thing share one name. A group's own name is a member too.
const SYN = Object.fromEntries(
  Object.entries({
    playstation: 'ps5 ps playstation',
    xbox: 'xbox series xsx xss',
    storage: 'storage space drive disk ssd hdd gb tb gigabyte',
    not: 'not doesnt dont cant wont isnt didnt cannot never',
  }).flatMap(([name, words]) => words.split(' ').flatMap((w) => [[w, name], [stem(w), name]])), // stem(w) so drives and spaces fold too
);
const WEAK = new Set(['playstation', 'xbox', 'not']); // console words say what the player owns, not what they ask; a no only colours the question: they count for less

const WEIGHT = { question: 4, keywords: 3, short: 2, topic: 1 };

const split = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/(\d)(\p{L})/gu, '$1 $2') // 512gb is 512 and gb
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t && (t.length > 1 || /\d/.test(t)) && !STOP.has(t));

function stem(w) {
  let s = w;
  if (s.length > 4 && s.endsWith('ies')) s = `${s.slice(0, -3)}y`;
  else if (s.length > 3 && s.endsWith('s') && !/(ss|us|is)$/.test(s)) s = s.slice(0, -1);
  if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith('ed')) s = s.slice(0, -2);
  return s.replace(/(.)\1$/, '$1').replace(/(?<=...)e$/, ''); // install and instal meet; save, saves, saving, saved meet
}

/** True when a and b are one edit apart (insert, delete, change, or swap two neighbours), or equal. */
function near(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const x = a.slice(i);
  const y = b.slice(i);
  return x.slice(1) === y.slice(1) || x.slice(1) === y || x === y.slice(1) || (x[0] === y[1] && x[1] === y[0] && x.slice(2) === y.slice(2));
}

function canon(w, forgiving = false) {
  const hit = SYN[w] ?? SYN[stem(w)];
  if (hit || !forgiving || w.length < 5) return hit ?? stem(w);
  const key = Object.keys(SYN).find((k) => k.length > 6 && near(w, k)); // playstaton is playstation
  return key ? SYN[key] : stem(w);
}

const words = (text) => [...new Set(split(text).map((w) => canon(w)))];
const fieldsOf = (r) => ({
  question: words(r.question),
  keywords: words((r.keywords ?? []).join(' ')),
  short: words(r.short),
  topic: words(String(r.topic ?? '').replace(/-/g, ' ')),
});

/** Weight of the best field where word q is found (0 for none). `typing` lets the word be an unfinished start. */
function weigh(fields, q, typing) {
  let best = 0;
  for (const [name, set] of Object.entries(fields)) {
    if (WEIGHT[name] <= best) continue;
    if (set.some((w) => w === q || (q.length > 4 && w.length > 3 && near(q, w)) || (typing && q.length > 2 && w.startsWith(q)))) best = WEIGHT[name];
  }
  return best;
}

/**
 * records: [{ id, question, short, topic, keywords?, rank? }]
 * Returns { found, closest }. `found` holds every record that matches at least half of the words the guide knows,
 * best first. `closest` is three answers to offer when found is empty: the best partial matches, else the most asked.
 */
export function search(records, query) {
  const raw = split(query);
  const qs = [...new Set(raw.map((t) => canon(t, true)))];
  const docs = records.map((r, i) => ({ r, i, f: fieldsOf(r) }));
  const last = raw.length ? canon(raw.at(-1), true) : '';
  const known = qs
    .map((q) => ({ q, hits: docs.filter((d) => weigh(d.f, q, q === last)).length }))
    .filter((k) => k.hits)
    .map((k) => ({ ...k, rare: Math.log(1 + docs.length / k.hits) })); // a word in few answers says more than one in most
  const scored = docs
    .map((d) => {
      let matched = 0;
      let count = 0;
      let score = 0;
      for (const k of known) {
        const w = weigh(d.f, k.q, k.q === last);
        if (!w) continue;
        const c = WEAK.has(k.q) ? 0.3 : 1;
        matched++;
        count += c;
        score += w * c * k.rare;
      }
      return { ...d, matched, count, score };
    })
    .filter((d) => d.matched)
    .sort((a, b) => b.count - a.count || b.score - a.score || (a.r.rank ?? 1e9) - (b.r.rank ?? 1e9) || a.i - b.i);
  const need = Math.ceil(known.length / 2);
  const found = scored.filter((d) => d.matched >= need).map((d) => d.r);
  const mostAsked = [...records].sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
  return { found, closest: (scored.length ? scored.map((d) => d.r) : mostAsked).slice(0, 3) };
}

/** A question about where something is: the guide keeps places behind the dial. */
export const asksWhere = (query) =>
  /\bwhere(s| is| are| can i (find|get|buy)| do i (find|get|buy))\b|\blocations? (of|for)\b|\bnearest\b|\bwhereabouts\b/.test(query.toLowerCase().replace(/['’]/g, ''));

/** Where a record's own page lives: /a/<id>/ for none, /<tier>/<id>/ for a hidden tier. */
export const pagePath = (tier, id) => (tier === 'none' ? `/a/${id}/` : `/${tier}/${id}/`);
