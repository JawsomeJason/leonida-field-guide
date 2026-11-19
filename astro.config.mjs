import { defineConfig } from 'astro/config';
import offline from './src/integrations/offline.mjs';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  integrations: [offline()],
});
