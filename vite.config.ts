import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

// Two pages: the public app (index.html) and the separate, login-protected editorial dashboard (admin.html).
export default defineConfig({
  plugins: [react(), tailwind()],
  build: { rollupOptions: { input: { main: 'index.html', admin: 'admin.html' } } },
})
