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
    // Disponible para quien quiera correr `npm run dev` con el mismo patron
    // same-origin /api que produccion (Fase 009A.1). OJO: VITE_API_BASE_URL
    // vacia ("") NO sirve para esto — resolveApiBaseUrl() la sigue tratando
    // como "no configurada" y lanza (a proposito: cambiar ese fallback de
    // desarrollo rompería el test que usa "" para simular justamente esa
    // ausencia, ver src/test/config.test.ts). En su lugar, apunte
    // VITE_API_BASE_URL al propio origen del dev server:
    //
    //   VITE_API_BASE_URL=http://localhost:5173
    //
    // Las llamadas resultantes (http://localhost:5173/api/v1/...) las
    // recibe este mismo dev server, que las reenvia aqui a un backend local
    // en :8000. No es obligatorio — VITE_API_BASE_URL apuntando directo al
    // backend (el flujo de siempre) sigue funcionando igual y no pasa por
    // este proxy en absoluto.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
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

