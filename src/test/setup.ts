import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";

import { afterEach, beforeEach, vi } from "vitest";

import { resetClientState } from "@/api/client";
import { vaciarTurnos } from "@/features/cotizadorV2/claves";

beforeEach(() => {
  // Cada prueba parte sin token CSRF ni refresh en vuelo, y sin turnos de
  // cotización retenidos por la anterior.
  resetClientState();
  vaciarTurnos();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetClientState();
});
