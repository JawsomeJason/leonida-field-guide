import { defineConfig } from 'astro/config';
import offline from './src/integrations/offline.mjs';
import { loadRecords } from './scripts/check-leak.mjs';
import { oldAddresses } from './src/lib/redirects.js';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  // A record that moved behind a gate leaves its old /a/<id>/ address: static redirect pages that point at the gate and hold none of the record's text.
  redirects: oldAddresses(loadRecords(process.env.LFG_CONTENT_DIR ?? './src/content/answers')),
  // The whole stylesheet is a few KB: inlining it removes the render-blocking request, which is the LCP floor.
  build: { inlineStylesheets: 'always' },
  integrations: [offline()],
});
