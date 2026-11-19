// Plain-sentence search over the loaded index. Pure (no DOM), so a test can import it.
// A query is cut into words; filler words go; each word is folded to a stem (plurals, -ing, -ed),
// console and storage words become synonyms, and a small typo in each word is forgiven (see weigh).
// A result is an answer only when a word matches its question or keywords and half the meaningful words are covered; a hit in the short text or the topic name alone is no match.
// No library: shortcut: stems are a few suffix rules, not a stemmer; upgrade if real queries miss.

// The one list of filler. A word here is never meaningful: it cannot make a match and cannot count against one.
const STOP = new Set(
  `a an the is are was were be am i me my we you your it its do does did how what whats when who which will would can could should
   to of on in at for with and or no if get there this that any have has about from so just much many where thats im ive
   keep keeps keeping want wants wanna need needs needed got gonna going go goes let lets like know tell take make use way ways thing things stuff some one
   play plays playing played game games gta best fast too also very really actually still again please thanks hey then than them they same anything everything something
   she her him his our out off over into`.split(/\s+/),
);
// Words so common in questions that matching one alone is no answer (mode, change, work): they rank, but never make a confident answer by themselves.
const GENERIC = new Set('mode change work problem issue help time new open first last tonight today now console version before after'.split(' ').map((w) => stem(w)));
const FILLER = [...STOP].filter((w) => w.length > 2);
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

// The things a player does. When a question names one, the answer about DOING it (the verb is in its question or keywords) leads the answers that only mention the noun.
const ACTION = new Set('save redeem install uninstall fix change download update unlock delete backup transfer restore claim reset'.split(' ').map((w) => stem(w)));

const BEFORE = new Set('i you we to can could do does should will would must'.split(' ')); // a verb follows these in a question ("do I save", "to download"); after a noun it is a plural ("my saves")
const toks = (t) => String(t ?? '').toLowerCase().replace(/['’]/g, '').split(SPLIT).filter(Boolean);
/** The query's subject verb: the word that comes right after "I", "we" or "you", or opens the question, or follows "how to" ("how do I save", "install the game"). */
const subjectVerbs = (query) => new Set(toks(query).filter((t) => !/^(actually|really|just|also|even|still)$/.test(t)).filter((t, i, a) => i === 0 || /^(i|we|you)$/.test(a[i - 1]) || (a[i - 1] === 'to' && a[i - 2] === 'how')).map((t) => canon(t, true)));
/** The action verbs a record is about: the first word of a keyword phrase, and a verb in its question that follows a BEFORE word or opens it. */
function actions(r) {
  const out = new Set();
  for (const p of r.keywords ?? []) toks(p).slice(0, 1).filter((t) => ACTION.has(stem(t))).forEach((t) => out.add(canon(t)));
  const q = toks(r.question);
  q.forEach((t, i) => ACTION.has(stem(t)) && (i === 0 || BEFORE.has(q[i - 1])) && out.add(canon(t)));
  return out;
}

const WEIGHT = { question: 4, keywords: 3, short: 2, topic: 1 };
const STRONG = 3; // a word found in the question or the keywords is a strong match; short and topic are weak

const SPLIT = /[^\p{L}\p{N}]+/u;
const split = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/\bco[- ]op\b/g, 'coop') // co-op and co op are one word; its two halves are too short to count alone
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

/** Edit distance between a and b where swapping two neighbours is one edit (optimal string alignment). */
function osa(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
/** True when a and b are one edit apart (insert, delete, change, or swap two neighbours), or equal. */
const near = (a, b) => Math.abs(a.length - b.length) <= 1 && osa(a, b) <= 1;
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
 * the player typed. A small typo is forgiven in each word, by its length: none up to 3 letters, one in 4 to 7, two from 8 (the stem's length for two). A letter more,
 * fewer or different counts when both stems have 5 letters or more (cash is not crash); two swapped neighbours are one typo, from 4 typed
 * letters. `verb` says the word met an action verb (ACTION) in the record's question or keywords. `typing` lets the word be an unfinished start.
 */
function weigh(fields, q, typing, len, acts) {
  let best = 0;
  let sum = 0;
  let verb = false;
  const tol = q.length > 7 ? 2 : len > 3 ? 1 : 0; // by the stem, so controls (control) is no typo of console
  const typo = (w) => {
    if (!tol || Math.abs(q.length - w.length) > tol) return false;
    if (Math.min(q.length, w.length) < 5) return swapped(q, w);
    const d = osa(q, w);
    return d <= 1 || (d <= tol && !w.startsWith(q) && !q.startsWith(w)); // two edits never make a longer word of a shorter one (stream, streamer)
  };
  for (const [name, set] of Object.entries(fields)) {
    const w = set.find((w) => w === q || typo(w) || (typing && q.length > 2 && w.startsWith(q)));
    if (w === undefined) continue;
    best = Math.max(best, WEIGHT[name]);
    sum += WEIGHT[name];
    verb ||= WEIGHT[name] >= STRONG && acts.has(w);
  }
  return { best, sum, verb };
}

/**
 * records: [{ id, question, short, topic, keywords?, rank? }]
 * Returns { found }: the confident answers, best first. A record is one only when a meaningful word matches its question or keywords
 * and the words found in it cover at least half of all the meaningful words typed, a word the guide has never seen counting against.
 * A hit in the short text or the topic name alone is not a match. When found is empty the guide has no answer, and shows nothing else.
 * A query made only of one topic's name lists that topic, so a topic hit counts as strong then.
 */
export function search(records, query) {
  const raw = split(query);
  const typed = new Map(); // folded word -> longest spelling typed
  for (const t of raw) typed.set(canon(t, true), Math.max(typed.get(canon(t, true)) ?? 0, t.length));
  const docs = records.map((r, i) => ({ r, i, f: fieldsOf(r), acts: actions(r), phrases: (r.keywords ?? []).map(words).filter((p) => p.length > 1) }));
  const subject = subjectVerbs(query);
  const last = raw.length ? canon(raw.at(-1), true) : '';
  const known = [...typed]
    .map(([q, len]) => ({ q, len, hits: docs.filter((d) => weigh(d.f, q, q === last, len, d.acts).best).length }))
    .filter((k) => k.hits)
    .map((k) => ({ ...k, rare: Math.log(1 + docs.length / k.hits), info: !GENERIC.has(k.q) && !WEAK.has(k.q) })); // a word in few answers says more than one in most
  // A word no answer holds that is a typo of a filler word (wher, shoud, hwo) is filler too, not a word the guide has never seen.
  const filler = (q, len = typed.get(q)) => !known.some((k) => k.q === q) && len < 7 && FILLER.some((s) => (len > 3 || s.length === 4 ? near(q, s) : swapped(q, s))); // a three-letter word only by a swap or a lost letter of a four-letter filler (wat is what): car is not can
  const asked = [...typed.keys()].filter((q) => !GENERIC.has(q) && !WEAK.has(q) && !filler(q)).length;
  const need = Math.ceil(asked / 2); // coverage is judged on every word that says what is asked (one the guide has never seen counts against), not on a console, a no or a mode
  const scored = docs
    .map((d) => {
      const browse = typed.size > 0 && [...typed.keys()].every((q) => d.f.topic.includes(q));
      let matched = 0; // informative words found anywhere in the record
      let count = 0;
      let strong = 0; // informative words found in its question or keywords
      let score = 0;
      let verb = 0; // action verbs the query names that the record's question or keywords hold
      let any = false;
      for (const k of known) {
        const { best, sum, verb: act } = weigh(d.f, k.q, k.q === last, k.len, d.acts);
        if (!best) continue;
        const c = WEAK.has(k.q) ? 0.3 : 1;
        any = true;
        if (act && subject.has(k.q)) verb++;
        count += c;
        score += sum * c * k.rare;
        if (k.info) {
          matched++;
          if (best >= STRONG || browse) strong++;
        }
      }
      const phrase = d.phrases.filter((p) => p.every((w) => typed.has(w))).length; // a keyword phrase the question holds whole, such as update before play
      return { ...d, matched, count, strong, score, any, phrase, verb };
    })
    .filter((d) => d.any);
  const answers = scored.filter((d) => d.strong && d.matched >= need);
  // The answer about doing the thing asked leads; then the rest as before.
  const best = (a, b) => b.verb - a.verb || b.strong - a.strong || b.count - a.count || b.phrase - a.phrase || b.score - a.score || (a.r.rank ?? 1e9) - (b.r.rank ?? 1e9) || a.i - b.i;
  const found = answers.sort(best).map((d) => d.r);
  return { found };
}

/** The consoles a record speaks to: its own list, the consoles it has byConsole text for, and the consoles its sources are tagged for. The index carries this as forConsoles. */
export const forConsoles = (r) => [...new Set([...(Array.isArray(r.consoles) ? r.consoles : []), ...Object.keys(r.byConsole ?? {}), ...(r.sources ?? []).flatMap((s) => s.console ?? [])])];

/**
 * The consoles a query names, when it names nothing else (console words plus filler): 'ps5', 'ps 5', 'playstation', 'xbox', 'x box', 'series x', 'sx', 'series s', 'ss'. Otherwise null.
 * A bare 'xbox' means the chosen console when that is an Xbox, else both Xboxes. shortcut: a typo is forgiven in 'playstation' and 'xbox' only, upgrade if players miss.
 */
function consoleIds(query, owned) {
  const text = String(query ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/\bx ?box\b/g, 'xbox')
    .replace(/\bplay ?station( ?5)?\b|\bps ?5\b|\bps\b/g, ' ps5 ')
    .replace(/\b(xbox )?series x\b|\bxbox x\b|\bxsx\b|\bsx\b/g, ' xboxx ')
    .replace(/\b(xbox )?series s\b|\bxbox s\b|\bxss\b|\bss\b/g, ' xboxs ')
    .replace(/\bseries\b/g, ' xbox ');
  const ids = new Set();
  for (const t of text.split(SPLIT).filter((w) => w && !STOP.has(w))) {
    if (t === 'xboxx' || t === 'xboxs') ids.add(`xbox-${t.at(-1)}`);
    else if (t === 'xbox' || (t[0] === 'x' && near(t, 'xbox'))) (owned?.startsWith('xbox') ? [owned] : ['xbox-x', 'xbox-s']).forEach((c) => ids.add(c));
    else if (t === 'ps5' || canon(t, true) === 'playstation') ids.add('ps5');
    else return null;
  }
  return ids.size ? [...ids] : null;
}

/**
 * What the page lists for a query: records is every record the dial allows. A query that only names a console lists that console's answers (the one the player
 * asked for, even when it is not theirs), console-tagged answers first, then the rest by rank. Any other query is a search over the answers for the chosen console.
 */
export function answersFor(records, query, owned) {
  const ids = consoleIds(query, owned);
  if (!ids) return search(records.filter((r) => !Array.isArray(r.consoles) || r.consoles.includes(owned)), query).found;
  const tagged = (r) => Array.isArray(r.consoles) && ids.some((c) => r.consoles.includes(c));
  return records
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => ids.some((c) => (r.forConsoles ?? forConsoles(r)).includes(c)))
    .sort((a, b) => tagged(b.r) - tagged(a.r) || (a.r.rank ?? 1e9) - (b.r.rank ?? 1e9) || a.i - b.i)
    .map(({ r }) => r);
}

// Words that say a player is asking about something being wrong, stemmed like the query. 'not working' is a phrase (a bare 'work' would catch "does not work", which has its own answer).
const KNOWN = new Set('bug buggy problem issue glitch glitchy broken broke outage error'.split(' ').map(stem));
/** A question about known problems: the page puts one row to /new/ ahead of any answers. */
export const asksKnown = (query) => {
  const text = String(query ?? '').toLowerCase().replace(/['’]/g, '');
  return text.split(SPLIT).some((w) => KNOWN.has(stem(w))) || /\b(not|isnt|arent|stopped) working\b/.test(text) || /\b(is|are)\b.*\bdown\b/.test(text);
};

/** A question about where something is: the guide keeps places behind the dial. */
export const asksWhere = (query) =>
  /\bwhere(s| is| are| can i (find|get|buy)| do i (find|get|buy))\b|\blocations?\b|\bnearest\b|\bwhereabouts\b|\bmaps?\b|\b(collectibles?|secrets?|easter eggs?|hidden packages?)\b/.test(query.toLowerCase().replace(/['’]/g, ''));

/** A question about the story: the guide carries none, by design, so with no real answer the page says so instead of "no answer yet". */
export const asksStory = (query) =>
  /\b(missions?|story|plot|endings?|campaign|characters?|cutscenes?|whos|who is)\b|\bhow (does|will) (the game|it) end\b/.test(String(query ?? '').toLowerCase().replace(/['’]/g, ''));

/** Why a query with no real answer gets a reason: 'places' (hidden by design, where-is note) or 'story' (no story content), else ''. */
export const noteFor = (query) => (asksWhere(query) ? 'places' : asksStory(query) ? 'story' : '');

/** Where a record's own page lives: /a/<id>/ for none, /<tier>/<id>/ for a hidden tier. */
export const pagePath = (tier, id) => (tier === 'none' ? `/a/${id}/` : `/${tier}/${id}/`);
