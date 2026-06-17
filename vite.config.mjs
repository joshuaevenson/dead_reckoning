import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  root: "ui",
  publicDir: false,
  build: {
    outDir: "../public",
    emptyOutDir: true,
  },
});
