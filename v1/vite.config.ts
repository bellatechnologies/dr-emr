import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Same-origin from the browser's view, so the session cookie just works — no CORS setup needed.
    proxy: { '/api': 'http://localhost:3001' },
  },
})
