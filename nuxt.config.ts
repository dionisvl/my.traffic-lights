// Nuxt 4 config (frontend only). Backend is external NestJS.
export default defineNuxtConfig({
  srcDir: ".",
  dir: { public: "public" },
  devtools: { enabled: false },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4000',
      wsUrl: process.env.NUXT_PUBLIC_WS_URL || 'http://localhost:4000',
    },
  },
  typescript: { strict: true },
  vite: {
    server: {
      allowedHosts: true,
    },
  },
  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0, user-scalable=no' }
      ],
    },
  },
})
