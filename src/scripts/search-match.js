// Plain-sentence search over the loaded index. Pure (no DOM), so a test can import it.
// A query is cut into words; filler words go; each word is folded to a stem (plurals, -ing, -ed),
// console and storage words become synonyms, and one typo is forgiven (see weigh).
// A result is a confident answer only when a word matches its question or keywords; a hit in the short text or the topic name is "possibly related".
// No library: shortcut: stems are a few suffix rules, not a stemmer; upgrade if real queries miss.

// The one list of filler. A word here is never meaningful: it cannot make a match and cannot count against one.
const STOP = new Set(
  `a an the is are was were be am i me my we you your it its do does did how what whats when who which will would can could should
   to of on in at for with and or no if get there this that any have has about from so just much many where thats im ive
   keep keeps keeping want wants wanna need needs needed got gonna going go goes let lets like know tell take make use way ways thing things stuff some one
   play plays playing played game games gta best fast too also very really actually still again please thanks hey then than them they same
   she her him his our out off over into`.split(/\s+/),
);
// Words so common in questions that matching one alone is no answer (mode, change, work): they rank, but never make a confident answer by themselves.
const GENERIC = new Set('mode change work problem issue help time new open first last tonight today now console version before after'.split(' ').map((w) => stem(w)));
const SHORT_OK = new Set(['pc', 'gb', 'tb', 'hz', 'tv', 'hd']); // real two-letter terms, and a number of two digits or more (60, 07); every other meaningful word has three letters or more

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
const STRONG = 3; // a word found in the question or the keywords is a strong match; short and topic are weak

const SPLIT = /[^\p{L}\p{N}]+/u;
const split = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/(\d)(\p{L})/gu, '$1 $2') // 512gb is 512 and gb
    .split(SPLIT)
    .filter((t) => t && (t.length > 2 || SHORT_OK.has(t) || (t.length > 1 && /\d/.test(t))) && !STOP.has(t));

function stem(w) {
  let s = w;
  if (s.length > 4 && s.endsWith('ies')) s = `${s.slice(0, -3)}y`;
  else if (s.length > 3 && s.endsWith('s') && !/(ss|us|is)$/.test(s)) s = s.slice(0, -1);
  if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith('ed')) s = s.slice(0, -2);
  return s.replace(/(.)\1$/, '$1').replace(/(?<=...)e$/, ''); // install and instal meet; save, saves, saving, saved meet
}

/** True when a and b are one edit apart (insert, delete, change, or swap two neighbours), or equal: optimal string alignment distance 1. */
function near(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const x = a.slice(i);
  const y = b.slice(i);
  return x.slice(1) === y.slice(1) || x.slice(1) === y || x === y.slice(1) || (x[0] === y[1] && x[1] === y[0] && x.slice(2) === y.slice(2));
}
/** Two neighbouring letters swapped and nothing else. */
const swapped = (a, b) => a.length === b.length && a !== b && near(a, b) && [...a].filter((c, i) => c !== b[i]).length === 2;

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

/**
 * How word q matches a record: { best, sum }. `best` is the weight of the best field it is found in (0 for none), `sum` adds every field
 * it is found in, so a word the record says in its question, its keywords and its short text counts for more. len is how many letters
 * the player typed. One typo is forgiven: a letter more, fewer or different when both stems have 5 letters or more (cash is not crash),
 * and two swapped neighbours in words of 4 typed letters or more. `typing` lets the word be an unfinished start.
 */
function weigh(fields, q, typing, len) {
  let best = 0;
  let sum = 0;
  const typo = (w) => (Math.min(q.length, w.length) > 4 && near(q, w)) || (len > 3 && swapped(q, w));
  for (const [name, set] of Object.entries(fields)) {
    if (set.some((w) => w === q || typo(w) || (typing && q.length > 2 && w.startsWith(q)))) {
      best = Math.max(best, WEIGHT[name]);
      sum += WEIGHT[name];
    }
  }
  return { best, sum };
}

/**
 * records: [{ id, question, short, topic, keywords?, rank? }]
 * Returns { found, related }.
 * `found` holds the confident answers, best first: records with a strong match (question or keywords) on at least half of the
 * meaningful words the guide knows. When found is empty the guide has no answer. `related` is then up to three records for a
 * "Possibly related" list: the best weaker matches (short or topic only, or too few of the words), else the most asked.
 * A query made only of one topic's name lists that topic, so a topic hit counts as strong then.
 */
export function search(records, query) {
  const raw = split(query);
  const typed = new Map(); // folded word -> longest spelling typed
  for (const t of raw) typed.set(canon(t, true), Math.max(typed.get(canon(t, true)) ?? 0, t.length));
  const docs = records.map((r, i) => ({ r, i, f: fieldsOf(r), phrases: (r.keywords ?? []).map(words).filter((p) => p.length > 1) }));
  const last = raw.length ? canon(raw.at(-1), true) : '';
  const known = [...typed]
    .map(([q, len]) => ({ q, len, hits: docs.filter((d) => weigh(d.f, q, q === last, len).best).length }))
    .filter((k) => k.hits)
    .map((k) => ({ ...k, rare: Math.log(1 + docs.length / k.hits), info: !GENERIC.has(k.q) && !WEAK.has(k.q) })); // a word in few answers says more than one in most
  const need = Math.ceil(known.filter((k) => k.info).length / 2); // coverage is judged on the words that say what is asked, not on a console, a no or a mode
  const scored = docs
    .map((d) => {
      const browse = typed.size > 0 && [...typed.keys()].every((q) => d.f.topic.includes(q));
      let matched = 0; // informative words found anywhere in the record
      let count = 0;
      let strong = 0; // informative words found in its question or keywords
      let score = 0;
      let any = false;
      for (const k of known) {
        const { best, sum } = weigh(d.f, k.q, k.q === last, k.len);
        if (!best) continue;
        const c = WEAK.has(k.q) ? 0.3 : 1;
        any = true;
        count += c;
        score += sum * c * k.rare;
        if (k.info) {
          matched++;
          if (best >= STRONG || browse) strong++;
        }
      }
      const phrase = d.phrases.filter((p) => p.every((w) => typed.has(w))).length; // a keyword phrase the question holds whole, such as update before play
      return { ...d, matched, count, strong, score, any, phrase };
    })
    .filter((d) => d.any);
  const answers = scored.filter((d) => d.strong && d.matched >= need);
  const best = (a, b) => b.strong - a.strong || b.count - a.count || b.phrase - a.phrase || b.score - a.score || (a.r.rank ?? 1e9) - (b.r.rank ?? 1e9) || a.i - b.i;
  const found = answers.sort(best).map((d) => d.r);
  if (found.length) return { found, related: [] };
  const mostAsked = [...records].sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
  return { found, related: (scored.length ? scored.sort(best).map((d) => d.r) : mostAsked).slice(0, 3) };
}

/** A question about where something is: the guide keeps places behind the dial. */
export const asksWhere = (query) =>
  /\bwhere(s| is| are| can i (find|get|buy)| do i (find|get|buy))\b|\blocations? (of|for)\b|\bnearest\b|\bwhereabouts\b/.test(query.toLowerCase().replace(/['’]/g, ''));

/** Where a record's own page lives: /a/<id>/ for none, /<tier>/<id>/ for a hidden tier. */
export const pagePath = (tier, id) => (tier === 'none' ? `/a/${id}/` : `/${tier}/${id}/`);
