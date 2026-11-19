// What each "how sure we are" label means, in one place: the About page and every answer page read this, so they cannot disagree.
export const confidence = {
  official: { label: 'Official', short: 'from the publisher or platform', text: 'The publisher or the console maker says it on its own website, and we read that page.' },
  reported: { label: 'Reported', short: 'from news sites or creators', text: 'A news site or creator says it and shows where it got it, but no official page confirms it.' },
  community: { label: 'Community', short: 'from players', text: 'Players report it. Treat it as likely, not certain.' },
};

export const OFFICIAL_HOSTS = ['rockstargames.com', 'take2games.com', 'playstation.com', 'xbox.com'];
export const onOfficialHost = (url) => {
  const host = new URL(url).hostname;
  return OFFICIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
};

// Strongest first. A record that mixes sources keeps `confidence` at its weakest claim, for filters; its page shows the claims.
const order = ['official', 'reported', 'community'];
export const weakest = (basis) => order.findLast((c) => basis.some((b) => b.confidence === c));

/**
 * What is wrong with a record's `basis` (nothing when it has none): each claim's label needs a source of its own standing.
 * @param {{ basis?: { claim: string, confidence: string }[], confidence: string, sources: { url: string }[] }} record
 * @returns {string[]}
 */
export const basisProblems = ({ basis, confidence: own, sources }) =>
  !basis
    ? []
    : [
        ...basis.filter((b) => !sources.some((s) => onOfficialHost(s.url) === (b.confidence === 'official'))).map((b) => `"${b.claim}" is ${b.confidence}, but no ${b.confidence === 'official' ? 'official-host' : 'non-official'} source backs it`),
        ...(own === weakest(basis) ? [] : [`confidence is ${own}, but the weakest claim is ${weakest(basis)}`]),
      ];

/**
 * What an official claim lacks: a `support` entry (claim, url, quote, checked) for it. An official record needs one for each
 * per-console line (naming that console) or, with no per-console lines, at least one; each official `basis` claim needs one with
 * the same claim text. An entry needs a url among the record's official-host sources, a quote of 1 to 200 characters and an ISO date.
 * Never shown to players. A quote is what the opened page said, written down by whoever opened it.
 * @param {{ id: string, confidence: string, basis?: { claim: string, confidence: string }[], byConsole?: object, sources: { url: string }[], support?: { claim: string, url: string, quote: string, checked: string, console?: string | string[] }[] }} record
 * @returns {string[]}
 */
export const supportProblems = (a) => {
  const claims = a.basis ? a.basis.filter((b) => b.confidence === 'official').map((b) => b.claim) : a.confidence === 'official' ? [null] : [];
  if (!claims.length) return [];
  const bad = [];
  const good = (a.support ?? []).filter((e) => {
    const why = [
      !e.quote?.trim() && 'an empty quote',
      e.quote?.length > 200 && 'a quote over 200 characters',
      !/^\d{4}-\d\d-\d\d$/.test(e.checked ?? '') && 'no date',
      !a.sources.some((s) => s.url === e.url && onOfficialHost(s.url)) && 'a url that is not one of its official sources',
    ].filter(Boolean);
    if (why.length) bad.push(`${a.id}: a support entry for "${e.claim}" has ${why.join(', ')}`);
    return !why.length;
  });
  for (const c of claims) {
    const mine = good.filter((e) => c === null || e.claim === c);
    const label = c === null ? 'the answer' : `"${c}"`;
    if (!mine.length) bad.push(`${a.id}: official claim ${label} has no support quote with a date`);
    else if (c === null)
      for (const k of Object.keys(a.byConsole ?? {})) if (!mine.some((e) => [].concat(e.console ?? []).includes(k))) bad.push(`${a.id}: official line for ${k} has no support quote naming ${k}`);
  }
  return bad;
};
