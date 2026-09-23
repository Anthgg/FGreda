import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";

import { afterEach, beforeEach, vi } from "vitest";

import { resetClientState } from "@/api/client";

beforeEach(() => {
  // Cada prueba parte sin token CSRF ni refresh en vuelo.
  resetClientState();
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
