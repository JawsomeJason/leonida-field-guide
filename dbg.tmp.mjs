import { loadRecords } from './scripts/check-leak.mjs';
import { answersFor } from './src/scripts/search-match.js';
const all = loadRecords('src/content/answers').filter((r) => r.tier === 'none');
for (const q of process.argv.slice(2)) console.log(JSON.stringify(q), answersFor(all, q, 'ps5').slice(0, 3).map((r) => r.id).join(',') || 'NONE');
