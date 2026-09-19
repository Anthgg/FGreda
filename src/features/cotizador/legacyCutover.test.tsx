/**
 * Fase 010J — el corte de la creación Legacy, en pantalla.
 *
 * Con el valor real de `CREACION_LEGACY_HABILITADA` (apagado): ninguna vía
 * general ofrece crear una Legacy, las direcciones de creación explican a dónde
 * ir, y una Legacy existente se sigue abriendo sin «Duplicar».
 */

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CREACION_LEGACY_HABILITADA } from "@/features/cotizador/legacyCutover";
import { jsonResponse, mockFetch, renderApp, sessionResponse } from "@/test/utils";

describe("corte de la creación Legacy (Fase 010J)", () => {
  it("la creación Legacy está apagada", () => {
    expect(CREACION_LEGACY_HABILITADA).toBe(false);
  });

  it.each(["/cotizador/nuevo", "/cotizaciones/nueva"])(
    "%s ya no monta un formulario: explica y lleva a V2",
    async (ruta) => {
      mockFetch((url) =>
        url.includes("/auth/me") ? sessionResponse() : jsonResponse(200, { items: [], total: 0 }),
      );

      renderApp([ruta]);

      const aviso = await screen.findByTestId("creacion-legacy-retirada");
      expect(aviso).toHaveTextContent("Las cotizaciones nuevas se hacen en el Cotizador V2");
      expect(screen.getByRole("link", { name: "Nueva cotización V2" })).toHaveAttribute(
        "href",
        "/cotizador-v2",
      );
      expect(screen.getByRole("link", { name: "Ver cotizaciones Legacy" })).toHaveAttribute(
        "href",
        "/cotizaciones",
      );
      expect(screen.queryByRole("button", { name: /guardar|crear/i })).not.toBeInTheDocument();
    },
  );

  it("ningún enlace de la app lleva a crear una Legacy", async () => {
    mockFetch((url) =>
      url.includes("/auth/me") ? sessionResponse() : jsonResponse(200, { items: [], total: 0 }),
    );

    renderApp(["/"]);

    await screen.findByRole("heading", { name: "Inicio." });
    const destinos = screen.getAllByRole("link").map((enlace) => enlace.getAttribute("href"));
    expect(destinos).not.toContain("/cotizador/nuevo");
    expect(destinos).not.toContain("/cotizaciones/nueva");
    expect(destinos).toContain("/cotizador-v2");
  });
});
