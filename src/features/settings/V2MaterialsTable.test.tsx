import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  COMMERCIAL_FILLED,
  COMPANY_FILLED,
  REFERENCE_DATA,
  SEQUENCES,
} from "@/test/settingsFixtures";
import { V2_CONFIG_PAGE, V2_MATERIALS, V2_MATERIAL_PRODUCTS } from "@/test/quoterV2Fixtures";
import { csrfResponse, jsonResponse, mockFetch, renderApp } from "@/test/utils";

/**
 * Valorizar un material es lo que hace usable todo lo demás de 010C: sin esta
 * pantalla el costo por gramo no se puede escribir desde ningún sitio y el
 * cotizador se queda mirando una lista vacía.
 */

const USER = {
  id: "11111111-2222-3333-4444-555555555555",
  email: "admin@empresa.com",
  display_name: "Administrador",
  role: "ADMIN" as const,
};

function mockSettings(overrides: { save?: Response } = {}) {
  return mockFetch((url, init) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: USER });
    if (url.includes("/quoter-v2/settings")) return jsonResponse(200, V2_CONFIG_PAGE);
    if (url.includes("/quoter-v2/materials")) {
      if ((init.method ?? "GET") === "PUT") {
        return overrides.save ?? jsonResponse(200, V2_MATERIALS.items[0]);
      }
      return jsonResponse(200, V2_MATERIALS);
    }
    if (url.includes("/products")) {
      // El filtro se respeta: la pantalla pregunta por materia prima y por
      // preparado en dos consultas, y devolver la lista entera a las dos
      // duplicaria cada material.
      const tipo = new URL(url, "http://x").searchParams.get("product_type");
      const items = V2_MATERIAL_PRODUCTS.filter((p) => p.product_type === tipo);
      return jsonResponse(200, { items, total: items.length, limit: 200, offset: 0 });
    }
    if (url.includes("/settings/reference-data")) return jsonResponse(200, REFERENCE_DATA);
    if (url.includes("/settings/company/logo")) return new Response(null, { status: 404 });
    if (url.includes("/settings/company")) return jsonResponse(200, COMPANY_FILLED);
    if (url.includes("/settings/commercial")) return jsonResponse(200, COMMERCIAL_FILLED);
    if (url.includes("/settings/sequences")) return jsonResponse(200, { sequences: SEQUENCES });
    return jsonResponse(200, {});
  });
}

async function abrirPestana() {
  const user = userEvent.setup();
  await screen.findByRole("tab", { name: "Cotizador V2" });
  await user.click(screen.getByRole("tab", { name: "Cotizador V2" }));
  return user;
}

describe("Valorización de materiales (Fase 010C)", () => {
  it("muestra el costo por unidad que derivó el backend", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    await abrirPestana();

    expect(await screen.findByText("Arcilla Terranova")).toBeInTheDocument();
    // 100 kg por S/100 más S/30 de transporte: S/0,0013 el gramo.
    expect(screen.getByText("0.001300000000")).toBeInTheDocument();
  });

  it("la lista sale del maestro, no de una lista fija de nombres", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    await abrirPestana();

    // Un material que nadie valorizó todavía aparece igual, y se puede
    // valorizar: si no apareciera, no habría forma de darle su primer costo.
    expect(await screen.findByText("Esmalte nuevo")).toBeInTheDocument();
    expect(screen.getByText("sin valorizar")).toBeInTheDocument();
  });

  it("un material sin stock se muestra, no se esconde", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    await abrirPestana();

    expect(await screen.findByText("Esmalte B")).toBeInTheDocument();
    expect(screen.getByText("0.000000")).toBeInTheDocument();
  });

  it("envía compra, transporte y tipo tal como se escribieron", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    await screen.findByText("Esmalte nuevo");
    await user.click(screen.getAllByRole("button", { name: "Valorizar" })[0]!);

    await user.type(await screen.findByLabelText(/cantidad comprada/i), "5000");
    await user.type(screen.getByLabelText(/costo de la compra/i), "900");
    const transporte = screen.getByLabelText("Transporte");
    await user.clear(transporte);
    await user.type(transporte, "100");
    await user.click(screen.getByRole("button", { name: /guardar valorización/i }));

    await waitFor(() => {
      const guardado = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).includes("/quoter-v2/materials/") &&
          (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(guardado).toBeDefined();
      const cuerpo = JSON.parse(String((guardado?.[1] as RequestInit).body));
      expect(cuerpo.purchase_quantity).toBe("5000");
      expect(cuerpo.purchase_cost).toBe("900");
      expect(cuerpo.transport_cost).toBe("100");
      // El costo por unidad NO viaja: lo deriva la base de datos.
      expect(cuerpo).not.toHaveProperty("effective_cost_per_unit");
    });
  });

  it("una cantidad vacía no se envía: no es un cero", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    await screen.findByText("Esmalte nuevo");
    await user.click(screen.getAllByRole("button", { name: "Valorizar" })[0]!);
    await user.type(await screen.findByLabelText(/costo de la compra/i), "900");
    await user.click(screen.getByRole("button", { name: /guardar valorización/i }));

    expect(await screen.findByText(/indique cuánto se compró/i)).toBeInTheDocument();
    const enviados = fetchSpy.mock.calls.filter(
      ([url, init]) =>
        String(url).includes("/quoter-v2/materials/") &&
        (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(enviados).toHaveLength(0);
  });

  it("una valorización manual vacía viaja como nula, no como cadena vacía", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    await screen.findByText("Esmalte nuevo");
    await user.click(screen.getAllByRole("button", { name: "Valorizar" })[0]!);
    await user.type(await screen.findByLabelText(/cantidad comprada/i), "5000");
    await user.type(screen.getByLabelText(/costo de la compra/i), "900");
    await user.click(screen.getByRole("button", { name: /guardar valorización/i }));

    await waitFor(() => {
      const guardado = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).includes("/quoter-v2/materials/") &&
          (init as RequestInit | undefined)?.method === "PUT",
      );
      const cuerpo = JSON.parse(String((guardado?.[1] as RequestInit).body));
      expect(cuerpo.costing_override_per_unit).toBeNull();
      expect(cuerpo.ml_per_gram).toBeNull();
    });
  });

  it("editar un material ya valorizado parte de lo que tenía", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    const celda = await screen.findByText("Arcilla Terranova");
    // Se busca DENTRO de su fila: hay un boton por material, y en esta misma
    // pestana la tabla de hornos tiene ademas los suyos.
    const fila = celda.closest("tr");
    expect(fila).not.toBeNull();
    await user.click(within(fila!).getByRole("button", { name: "Editar valorización" }));

    expect(await screen.findByLabelText(/cantidad comprada/i)).toHaveValue("100000.000000");
    expect(screen.getByLabelText(/costo de la compra/i)).toHaveValue("100.000000");
    expect(screen.getByLabelText("Transporte")).toHaveValue("30.000000");
  });

  it("dice que valorizar no recalcula lo ya cotizado", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    await abrirPestana();

    expect(await screen.findByText(/no se recalculan/i)).toBeInTheDocument();
  });
});
