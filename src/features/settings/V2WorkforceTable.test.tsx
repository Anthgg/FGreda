import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  COMMERCIAL_FILLED,
  COMPANY_FILLED,
  REFERENCE_DATA,
  SEQUENCES,
} from "@/test/settingsFixtures";
import {
  V2_CONFIG_PAGE,
  V2_MATERIALS,
  V2_MATERIAL_PRODUCTS,
  V2_TECHNIQUES,
  V2_WORKERS,
} from "@/test/quoterV2Fixtures";
import { csrfResponse, jsonResponse, mockFetch, renderApp } from "@/test/utils";

/**
 * Los maestros que hacen posible costear la mano de obra: cuánto cuesta un día
 * de cada persona y cuánto rinde una jornada de cada técnica. Sin esta
 * pantalla, ninguno de los dos números se puede escribir desde ningún sitio.
 */

const USER = {
  id: "11111111-2222-3333-4444-555555555555",
  email: "admin@empresa.com",
  display_name: "Administrador",
  role: "ADMIN" as const,
};

function mockSettings() {
  return mockFetch((url, init) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: USER });
    if (url.includes("/quoter-v2/settings")) return jsonResponse(200, V2_CONFIG_PAGE);
    if (url.includes("/quoter-v2/workers")) {
      if ((init.method ?? "GET") !== "GET") return jsonResponse(201, V2_WORKERS.items[0]);
      return jsonResponse(200, V2_WORKERS);
    }
    if (url.includes("/quoter-v2/techniques")) {
      if ((init.method ?? "GET") !== "GET") return jsonResponse(201, V2_TECHNIQUES.items[0]);
      return jsonResponse(200, V2_TECHNIQUES);
    }
    if (url.includes("/quoter-v2/materials")) return jsonResponse(200, V2_MATERIALS);
    if (url.includes("/products")) {
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

describe("Trabajadores y técnicas (Fase 010D)", () => {
  it("muestra la tarifa por hora derivada del jornal", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    await abrirPestana();

    // S/120 en la jornada de 8 h del taller son S/15 la hora.
    expect(await screen.findByText("Celso")).toBeInTheDocument();
    expect(screen.getByText("15.000000000000")).toBeInTheDocument();
  });

  it("dice que la tarifa por hora no se escribe, se deriva", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    await abrirPestana();

    expect(await screen.findByText(/no se escribe: es el jornal entre la jornada/i)).toBeInTheDocument();
  });

  it("deja claro que un trabajador del taller no cuesta cero", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    await abrirPestana();

    expect(await screen.findByText(/aun así sus horas cuestan/i)).toBeInTheDocument();
  });

  it("la técnica guarda rendimiento y no precio", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    await abrirPestana();

    expect(await screen.findByText("Vidriado")).toBeInTheDocument();
    // 50 piezas por jornada de 8 h son 6,25 por hora, y lo calcula el backend.
    expect(screen.getByText("6.250000000000")).toBeInTheDocument();
    expect(screen.getByText(/no cuánto cuesta/i)).toBeInTheDocument();
  });

  it("dice que el rendimiento es un estándar y no una medición", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    await abrirPestana();

    expect(
      await screen.findByText(/no lo cambia solo porque un día se produzca más o menos/i),
    ).toBeInTheDocument();
  });

  it("un jornal vacío no se envía: no es un cero", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    await screen.findByText("Celso");
    await user.type(screen.getAllByLabelText("Nombre")[0]!, "Nuevo");
    await user.click(screen.getByRole("button", { name: /dar de alta/i }));

    expect(await screen.findByText(/indique cuánto cuesta un día/i)).toBeInTheDocument();
    const enviados = fetchSpy.mock.calls.filter(
      ([url, init]) =>
        String(url).includes("/quoter-v2/workers") &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    expect(enviados).toHaveLength(0);
  });

  it("una jornada propia vacía viaja como nula: significa la del taller", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    await screen.findByText("Celso");
    await user.type(screen.getAllByLabelText("Nombre")[0]!, "Nuevo");
    await user.type(screen.getByLabelText("Jornal"), "150");
    await user.click(screen.getByRole("button", { name: /dar de alta/i }));

    await waitFor(() => {
      const alta = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).includes("/quoter-v2/workers") &&
          (init as RequestInit | undefined)?.method === "POST",
      );
      expect(alta).toBeDefined();
      const cuerpo = JSON.parse(String((alta?.[1] as RequestInit).body));
      expect(cuerpo.daily_rate).toBe("150");
      expect(cuerpo.workday_hours).toBeNull();
      // La tarifa por hora NO viaja: la deriva el backend.
      expect(cuerpo).not.toHaveProperty("hourly_rate");
    });
  });

  it("un rendimiento de cero se explica en vez de enviarse", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    await screen.findByText("Vidriado");
    await user.type(screen.getByLabelText("Código"), "nueva");
    await user.type(screen.getAllByLabelText("Nombre")[1]!, "Nueva");
    await user.type(screen.getByLabelText("Rinde por jornada"), "0");
    await user.click(screen.getByRole("button", { name: /añadir al catálogo/i }));

    expect(await screen.findByText(/sería una división por cero/i)).toBeInTheDocument();
    const enviados = fetchSpy.mock.calls.filter(
      ([url, init]) =>
        String(url).includes("/quoter-v2/techniques") &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    expect(enviados).toHaveLength(0);
  });

  it("dar de baja declara la versión leída, para no pisar a quien llegó antes", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    await screen.findByText("Celso");
    await user.click(screen.getAllByRole("button", { name: "Dar de baja" })[0]!);

    await waitFor(() => {
      const baja = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).includes("/quoter-v2/workers/1") &&
          (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(baja).toBeDefined();
      const cuerpo = JSON.parse(String((baja?.[1] as RequestInit).body));
      expect(cuerpo.expected_version).toBe(1);
      expect(cuerpo.active).toBe(false);
    });
  });
});
