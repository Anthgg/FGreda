import "@testing-library/jest-dom/vitest";

import { afterEach, beforeEach, vi } from "vitest";

import { resetClientState } from "@/api/client";

beforeEach(() => {
  // Cada prueba parte sin token CSRF ni refresh en vuelo.
  resetClientState();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetClientState();
});
