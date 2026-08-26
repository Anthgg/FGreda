/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    restoreMocks: true,
    // VITE_API_BASE_URL se usa como fallback en tests (en lugar de runtime-config.js,
    // que no existe en jsdom). El valor es irrelevante para las pruebas unitarias
    // del cliente HTTP, que mockean fetch directamente.
    env: {
      VITE_API_BASE_URL: "http://localhost:8000",
    },
  },
});

