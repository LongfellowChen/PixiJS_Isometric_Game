import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/PixiJS_Isometric_Game/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})