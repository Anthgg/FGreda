import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginParticleBackground } from "@/features/auth/LoginParticleBackground";

describe("fondo de partículas del login", () => {
  it("dibuja una escena estática sin requestAnimationFrame con reduced motion", () => {
    const context = {
      beginPath: vi.fn(),
      closePath: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillStyle: "",
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(() => context);

    const requestFrame = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() =>
        ({
          matches: true,
          media: "(prefers-reduced-motion: reduce)",
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
      ),
    );

    const { container } = render(<LoginParticleBackground />);

    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
    expect(context.setTransform).toHaveBeenCalled();
    expect(context.fillRect).toHaveBeenCalled();
    expect(requestFrame).not.toHaveBeenCalled();
  });
});
