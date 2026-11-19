/** Old default addresses of records that sit behind a gate: /a/<id>/ goes to the gate address /<tier>/<id>/ (never the explicit /show/ one).
 *  Derived from the content, so a record that moves tier gets its redirect with no list to keep. A `none` record keeps its own /a/ page. */
export const oldAddresses = (records) => Object.fromEntries(records.filter((a) => a.tier !== 'none').map((a) => [`/a/${a.id}/`, `/${a.tier}/${a.id}/`]));
