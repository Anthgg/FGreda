import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  COMMERCIAL_FILLED,
  COMPANY_FILLED,
  REFERENCE_DATA,
  SEQUENCES,
} from "@/test/settingsFixtures";
import { csrfResponse, errorResponse, jsonResponse, mockFetch, renderApp } from "@/test/utils";

const CONFIG = {
  version: 1,
  updated_at: "2026-09-11T10:00:00Z",
  workday_hours: "8.000000",
  space_service_cost_per_day: "140.000000",
  administrative_cost_per_quote: "200.000000",
  commercial_factor_default: "3.000000",
  commercial_factor_min: "2.000000",
  commercial_factor_max: "3.000000",
  quotation_validity_days: 20,
  default_exchange_rate: "3.500000",
  default_production_type: "RETAIL",
  default_customer_kind: "EXTERNAL",
  retail_kiln_id: null,
  wholesale_kiln_id: null,
  low_fire_enabled_default: true,
  high_fire_enabled_default: true,
  illustration_daily_rate: "110.000000",
  illustration_pieces_per_workday: "50.000000",
  illustration_hourly_rate: "13.750000",
  illustration_pieces_per_hour: "6.250000",
  tax_percent: "18.000000",
  currency_code: "PEN",
  currency_symbol: "S/",
  canonical_source: "commercial_settings",
};

const PAGINA = {
  settings: CONFIG,
  kiln_rates: [
    {
      kiln_id: 1,
      kiln_code: "KILN-001",
      kiln_name: "Horno chico",
      firing_type: "LOW",
      gas_cost: "35.000000",
      external_rate: "200.000000",
      student_rate: "90.000000",
      configured: true,
    },
    {
      kiln_id: 1,
      kiln_code: "KILN-001",
      kiln_name: "Horno chico",
      firing_type: "HIGH",
      gas_cost: "0.000000",
      external_rate: "0.000000",
      student_rate: "0.000000",
      configured: false,
    },
  ],
  reference_rates: {
    SMALL: { gas_cost_low: "35", external_rate_low: "200", student_rate_low: "90" },
    LARGE: { gas_cost_low: "55", external_rate_low: "700", student_rate_low: "1000" },
  },
};

const USER = {
  id: "11111111-2222-3333-4444-555555555555",
  email: "admin@empresa.com",
  display_name: "Administrador",
  role: "ADMIN" as const,
};

/** Resuelve sesión, la configuración V2 y lo mínimo que pide la página. */
function mockSettings(overrides: { page?: Response; save?: Response } = {}) {
  return mockFetch((url, init) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: USER });
    if (url.includes("/quoter-v2/settings")) {
      if ((init.method ?? "GET") === "PUT") {
        return overrides.save ?? jsonResponse(200, PAGINA);
      }
      return overrides.page ?? jsonResponse(200, PAGINA);
    }
    // El resto de Configuración, con las fixtures reales: la pantalla no monta
    // ninguna pestaña hasta que TODAS sus consultas resuelven, asi que una
    // respuesta inventada aqui esconderia la pestaña que se quiere probar.
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

describe("Configuración del Cotizador V2 (Fase 010B)", () => {
  it("vive en Configuración, no dentro del flujo de una cotización", async () => {
    mockSettings();

    renderApp(["/configuracion"]);

    expect(await screen.findByRole("tab", { name: "Cotizador V2" })).toBeInTheDocument();
  });

  it("muestra los valores aprobados", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    await abrirPestana();

    expect(await screen.findByLabelText(/jornada \(horas\)/i)).toHaveValue("8.000000");
    expect(screen.getByLabelText(/espacio y servicios por día/i)).toHaveValue("140.000000");
    expect(screen.getByLabelText(/administración por cotización/i)).toHaveValue("200.000000");
    expect(screen.getByLabelText(/vigencia \(días\)/i)).toHaveValue("20");
  });

  it("el IGV se muestra pero no se edita aquí: su dueño es Comercial", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    await abrirPestana();

    const igv = await screen.findByLabelText(/igv/i);
    expect(igv).toHaveValue("18.000000");
    expect(igv).toHaveAttribute("readonly");
  });

  it("la tarifa por hora de ilustración se muestra como derivada", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    await abrirPestana();

    const tarifa = await screen.findByLabelText(/tarifa por hora/i);
    expect(tarifa).toHaveValue("13.750000");
    expect(tarifa).toHaveAttribute("readonly");
  });

  it("guarda enviando la versión leída, para no pisar otro cambio", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    const campo = await screen.findByLabelText(/espacio y servicios por día/i);
    await user.clear(campo);
    await user.type(campo, "160");
    await user.click(screen.getByRole("button", { name: /guardar configuración v2/i }));

    await waitFor(() => {
      const guardado = fetchSpy.mock.calls.find(
        ([url, init]) =>
          String(url).includes("/quoter-v2/settings") &&
          (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(guardado).toBeDefined();
      const cuerpo = JSON.parse(String((guardado?.[1] as RequestInit).body));
      expect(cuerpo.expected_version).toBe(1);
      expect(cuerpo.space_service_cost_per_day).toBe("160");
      // El IGV no viaja por esta puerta.
      expect(cuerpo).not.toHaveProperty("tax_percent");
    });
  });

  it("un factor mínimo por debajo de ×2 no se envía", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    const campo = await screen.findByLabelText(/factor mínimo/i);
    await user.clear(campo);
    await user.type(campo, "1.5");
    await user.click(screen.getByRole("button", { name: /guardar configuración v2/i }));

    expect(await screen.findByText(/no puede bajar de ×2/i)).toBeInTheDocument();
    const guardados = fetchSpy.mock.calls.filter(
      ([url, init]) =>
        String(url).includes("/quoter-v2/settings") &&
        (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(guardados).toHaveLength(0);
  });

  it("una jornada de cero horas no se envía", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    const campo = await screen.findByLabelText(/jornada \(horas\)/i);
    await user.clear(campo);
    await user.type(campo, "0");
    await user.click(screen.getByRole("button", { name: /guardar configuración v2/i }));

    expect(await screen.findByText(/mayor que cero/i)).toBeInTheDocument();
  });

  it("muestra los tres números de cada horno por separado", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    await abrirPestana();

    // La fila de BAJA, que es la que trae los tres numeros configurados.
    const filas = await screen.findAllByText("Horno chico");
    const fila = filas
      .map((celda) => celda.closest("tr"))
      .find((tr) => tr?.textContent?.includes("Baja"));
    expect(fila).toBeTruthy();
    const celdas = within(fila as HTMLElement);
    expect(celdas.getByText("35.000000")).toBeInTheDocument();
    expect(celdas.getByText("200.000000")).toBeInTheDocument();
    expect(celdas.getByText("90.000000")).toBeInTheDocument();
  });

  it("un horno sin tarifa se puede configurar desde la tabla", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    // La rejilla llega completa, asi que la fila de alta existe aunque nadie
    // haya guardado nada todavia. Sin eso no habria por donde empezar.
    await screen.findAllByText("Horno chico");
    const botones = screen.getAllByRole("button", { name: /configurar/i });
    expect(botones.length).toBeGreaterThan(0);
    await user.click(botones[0] as HTMLElement);

    expect(screen.getAllByLabelText(/gas_cost de Horno chico/i).length).toBeGreaterThan(0);
  });

  it("una tarifa sin configurar no se confunde con un cero elegido", async () => {
    mockSettings();
    renderApp(["/configuracion"]);
    await abrirPestana();

    await screen.findAllByText("Horno chico");
    expect(screen.getAllByText(/sin configurar/i).length).toBeGreaterThan(0);
  });

  it("un fallo al guardar una tarifa se explica, no se pierde en silencio", async () => {
    mockSettings({ save: errorResponse(422, "VALIDATION_ERROR", "Importe invalido") });
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    await screen.findAllByText("Horno chico");
    await user.click(screen.getAllByRole("button", { name: /^editar$/i })[0] as HTMLElement);
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("editar una tarifa envia los tres importes, no solo el tocado", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    await screen.findAllByText("Horno chico");
    await user.click(screen.getAllByRole("button", { name: /^editar$/i })[0] as HTMLElement);
    const campo = screen.getByLabelText(/external_rate de Horno chico LOW/i);
    await user.clear(campo);
    await user.type(campo, "250");
    await user.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => {
      const guardado = fetchSpy.mock.calls.find(([url]) => String(url).includes("/kiln-rates/"));
      expect(guardado).toBeDefined();
      const cuerpo = JSON.parse(String((guardado?.[1] as RequestInit).body));
      expect(cuerpo).toEqual({
        gas_cost: "35.000000",
        external_rate: "250",
        student_rate: "90.000000",
      });
    });
  });

  it("un campo obligatorio vacio no se envia como cero", async () => {
    const fetchSpy = mockSettings();
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    // `Number("")` da 0 y pasaria cualquier comprobacion de «>= 0».
    const campo = await screen.findByLabelText(/espacio y servicios por día/i);
    await user.clear(campo);
    expect(campo).toHaveValue("");
    await user.click(screen.getByRole("button", { name: /guardar configuración v2/i }));

    expect(await screen.findByText(/indique un valor/i)).toBeInTheDocument();
    const guardados = fetchSpy.mock.calls.filter(
      ([url, init]) =>
        String(url).includes("/quoter-v2/settings") &&
        (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(guardados).toHaveLength(0);
  });

  it("un conflicto de versión se explica en vez de perderse", async () => {
    mockSettings({
      save: errorResponse(409, "V2_SETTINGS_VERSION_CONFLICT", "La configuración cambió"),
    });
    renderApp(["/configuracion"]);
    const user = await abrirPestana();

    await screen.findByLabelText(/jornada \(horas\)/i);
    await user.click(screen.getByRole("button", { name: /guardar configuración v2/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("un error de carga no deja la pantalla en blanco", async () => {
    mockSettings({ page: errorResponse(500, "INTERNAL_ERROR") });
    renderApp(["/configuracion"]);
    await abrirPestana();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
