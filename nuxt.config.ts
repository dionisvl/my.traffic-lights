// Nuxt 3 config (frontend only). Backend is external NestJS.
export default defineNuxtConfig({
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4000',
      wsUrl: process.env.NUXT_PUBLIC_WS_URL || 'http://localhost:4000',
    },
  },
  typescript: { strict: true },
  app: {
    head: {
      script: [
        { src: 'https://cdn.socket.io/4.7.2/socket.io.min.js', defer: true },
      ],
    },
  },
})
