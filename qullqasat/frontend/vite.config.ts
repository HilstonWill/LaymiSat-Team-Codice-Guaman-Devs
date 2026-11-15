import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// LAYMI_API_PROXY (variable de entorno o .env.<modo>) apunta el proxy de desarrollo a otra API local.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const apiTarget = env.LAYMI_API_PROXY || 'http://127.0.0.1:8000'
  return {
    plugins: [react()],
    server: { proxy: { '/api': apiTarget } },
  }
})
