import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    target: 'es2018'
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
