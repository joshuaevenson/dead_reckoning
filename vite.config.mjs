import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  root: "ui",
  publicDir: false,
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/health": "http://127.0.0.1:8787",
      "/simulate": "http://127.0.0.1:8787",
    },
  },
  build: {
    outDir: "../public",
    emptyOutDir: true,
  },
});
