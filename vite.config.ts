import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  base: "/private-vid-ai/", // 👈 SUPER IMPORTANT for GitHub Pages

  build: {
    rollupOptions: {
      input: {
        main: "index.html",
      },
    },
  },
});
