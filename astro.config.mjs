import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://filibrary.thenextlayer.com',
  build: {
    assets: '_assets',
  },
});
