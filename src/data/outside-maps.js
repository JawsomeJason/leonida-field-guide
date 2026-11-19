// The two outside map sites, the date they were last looked at and the one line said beside them: the single place every page reads.
// We make no claim about what the sites do. Update `checked` only after someone opens both in a fresh browser.
export const mapsChecked = '2026-11-19';
const long = new Date(mapsChecked).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const mapLinks = [
  { href: 'https://gtamap.io', title: 'gtamap.io' },
  { href: 'https://fullsweepmap.com', title: 'FullSweep' },
];

export const mapsLine = `We do not control these sites. On ${long} at least one showed story content by default, so set its own spoiler option before you look.`;

/** Said wherever the links are not shown (the dial is Off, or unknown without script): no link, no name, no claim. */
export const mapsOffLine = 'Outside maps exist; they appear here once Places is on.';
