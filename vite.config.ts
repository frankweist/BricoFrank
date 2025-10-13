import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// cambia NOMBRE_REPO por el de tu repo GitHub
export default defineConfig({
  plugins: [react()],
  base: '/BricoFrank/'
})
