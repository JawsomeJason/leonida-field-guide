// The two outside map sites, the date they were last looked at and the one line said beside them. We make no claim about what the
// sites do: the line is our own dated observation. Update `checked` and the line only after someone opens both in a fresh browser.
// Server side only: this module is read by the Places fragment (src/pages/h/places/maps.astro) and nothing that ships to the browser,
// so no map address is in any default page or script (check:leak holds that).
export const mapsChecked = '2026-11-19';
const long = new Date(mapsChecked).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const mapLinks = [
  { href: 'https://gtamap.io', title: 'gtamap.io' },
  { href: 'https://fullsweepmap.com', title: 'FullSweep' },
];

export const mapsLine = `On ${long} we opened both sites in a fresh browser. One showed story content by default; the other had no spoiler control. We do not control them, so set a spoiler option, if there is one, before you look.`;

/** Said wherever the links are not shown (the dial is Off, or unknown without script): no link, no name, no claim. */
export const mapsOffLine = 'Outside maps exist; they appear here once Places is on.';
