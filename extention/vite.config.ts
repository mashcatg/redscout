import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json" with { type: "json" };
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), crx({ manifest: manifest as any })],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  build: {
    target: "esnext",
    sourcemap: false,
    rollupOptions: { input: { popup: "src/popup/index.html" } },
  },
  server: { port: 5174, strictPort: true, hmr: { port: 5174 } },
});
