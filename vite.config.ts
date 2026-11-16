import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the static build works from any sub-path (play.kkmurado.com/gacha/ etc.)
export default defineConfig({
  plugins: [react()],
  base: './',
})
