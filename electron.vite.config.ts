import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

const builtinPattern =
  /^(electron|electron-updater|sql\.js|node:.+|fs|path|crypto|url|os|stream|events|child_process|http|zlib|util|assert|constants)$/;

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist-electron",
      rollupOptions: {
        input: { main: resolve(__dirname, "electron/main.ts") },
        output: { format: "cjs", entryFileNames: "[name].js" },
        external: builtinPattern,
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
        external: builtinPattern,
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
