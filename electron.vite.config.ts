import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist-electron",
      rollupOptions: {
        input: { main: resolve(__dirname, "electron/main.ts") },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist-electron",
      emptyOutDir: false,
      rollupOptions: {
        input: { preload: resolve(__dirname, "electron/preload.ts") },
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    root: ".",
    plugins: [react(), tailwindcss()],
    build: {
      outDir: "dist/renderer",
      rollupOptions: {
        input: { index: resolve(__dirname, "index.html") },
      },
    },
    server: {
      port: 1420,
      strictPort: true,
    },
  },
});
