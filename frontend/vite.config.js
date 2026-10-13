import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/orders': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/payments': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/actuator/order': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/actuator\/order/, '/actuator'),
        changeOrigin: true,
      },
      '/actuator/payment': {
        target: 'http://localhost:8081',
        rewrite: (path) => path.replace(/^\/actuator\/payment/, '/actuator'),
        changeOrigin: true,
      },
    },
  },
})

