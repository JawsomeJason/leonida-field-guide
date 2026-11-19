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

/** What is wrong with a record's `basis` (none when it has none): each claim's label needs a source of its own standing. */
export const basisProblems = ({ basis, confidence: own, sources }) =>
  !basis
    ? []
    : [
        ...basis.filter((b) => !sources.some((s) => onOfficialHost(s.url) === (b.confidence === 'official'))).map((b) => `"${b.claim}" is ${b.confidence}, but no ${b.confidence === 'official' ? 'official-host' : 'non-official'} source backs it`),
        ...(own === weakest(basis) ? [] : [`confidence is ${own}, but the weakest claim is ${weakest(basis)}`]),
      ];
