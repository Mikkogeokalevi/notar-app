import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/notar-app/', // <--- TÄRKEÄ: Pitää olla sama kuin repon nimi!
})