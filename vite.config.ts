import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";

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
    // e2e/ son specs de Playwright (otro test runner, otro `test.describe`);
    // el glob por defecto de Vitest los recoge tambien porque terminan en
    // .spec.ts, y ambos runners chocan al importarlos.
    exclude: [...configDefaults.exclude, "e2e/**"],
    // VITE_API_BASE_URL se usa como fallback en tests (en lugar de runtime-config.js,
    // que no existe en jsdom). El valor es irrelevante para las pruebas unitarias
    // del cliente HTTP, que mockean fetch directamente.
    env: {
      VITE_API_BASE_URL: "http://localhost:8000",
    },
  },
});

