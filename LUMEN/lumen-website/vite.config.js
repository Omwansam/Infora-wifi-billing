import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // 5175 matches the docker-compose dev profile; 5173/5174 belong to the
  // billing app and the demo.
  server: { port: 5175 },
  preview: { port: 5175 },
})
