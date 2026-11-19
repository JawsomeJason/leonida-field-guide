import { defineConfig } from 'astro/config';
import offline from './src/integrations/offline.mjs';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  // The whole stylesheet is a few KB: inlining it removes the render-blocking request, which is the LCP floor.
  build: { inlineStylesheets: 'always' },
  integrations: [offline()],
});
