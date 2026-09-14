import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/client";
import {
  AVISOS_DE_DUPLICACION,
  BLOQUEOS_DE_EMISION,
  describirAvisoDeDuplicacion,
  describirBloqueo,
  describirEvento,
} from "@/features/cotizadorV2/mensajesCicloDeVida";
import { describeError } from "@/features/settings/messages";
import {
  V2_FIRING,
  V2_ILLUSTRATION,
  V2_LABOR_PAGE,
  V2_PRICING,
  V2_TECHNIQUES,
  V2_WORKERS,
} from "@/test/quoterV2Fixtures";
import { csrfResponse, errorResponse, jsonResponse, mockFetch, renderApp } from "@/test/utils";

/**
 * Fase 010H — el ciclo de vida de una cotización V2 en pantalla.
 *
 * Lo que estas pruebas fijan no es el aspecto sino las reglas que la pantalla
 * no puede romper: el estado se dice con palabras, una vencida no ofrece pasar
 * a producción, duplicar navega a OTRA cotización, confirmar manda la huella
 * que se revisó y un 409 recarga el resumen en vez de emitir a ciegas.
 */

const USER = {
  id: "11111111-2222-3333-4444-555555555555",
  email: "admin@empresa.com",
  display_name: "Administrador",
  role: "ADMIN" as const,
};

const BASE = {
  id: 7,
  code: "CTZ-V2-2026-000007",
  pricing_engine_version: "V2",
  status: "DRAFT",
  effective_status: "DRAFT",
  production_type: "RETAIL",
  customer_id: 3,
  customer_name: "Cerámicas Andinas SAC",
  name: "Pedido interno",
  notes: null,
  client_notes: null,
  customer_kind: "EXTERNAL",
  tax_percent: "18.000000",
  currency_code: "PEN",
  currency_symbol: "S/",
  exchange_rate: null,
  validity_days: 20,
  workday_hours: "8.000000",
  space_service_cost_per_day: "140.000000",
  administrative_cost: "200.000000",
  commercial_factor: "3.000000",
  commercial_factor_min: "2.000000",
  commercial_factor_max: "3.000000",
  low_fire_enabled: true,
  high_fire_enabled: true,
  settings_version: 1,
  created_at: "2026-09-10T15:00:00Z",
  updated_at: "2026-09-10T15:00:00Z",
  issued_at: null,
  valid_until: null,
  expires_at: null,
  issued_by_name: null,
  cancelled_at: null,
  cancelled_by_name: null,
  cancel_reason: null,
  duplicated_from_id: null,
  open_duplicate_id: null,
  production_handoff: null,
};

const EMITIDA = {
  ...BASE,
  status: "CONFIRMED",
  effective_status: "CONFIRMED",
  issued_at: "2026-09-11T02:30:00Z", // 21:30 del 10/09 en Lima
  valid_until: "2026-09-30",
  expires_at: "2026-10-01T05:00:00Z",
  issued_by_name: "Ana Emisora",
};

const PREVIEW = {
  quotation_id: 7,
  code: BASE.code,
  status: "DRAFT",
  effective_status: "DRAFT",
  can_confirm: true,
  blockers: [],
  warnings: [],
  fingerprint: "a".repeat(64),
  customer_name: "Cerámicas Andinas SAC",
  customer_document: "RUC: 20600000001",
  customer_address: "Jr. Barro 456, Lima",
  customer_email: null,
  customer_phone: null,
  conditions: "Adelanto del 50 %.",
  payment_notes: "Transferencia bancaria.",
  name: "Pedido interno",
  client_notes: null,
  currency_code: "PEN",
  currency_symbol: "S/",
  exchange_rate: null,
  tax_percent: "18.000000",
  commercial_factor: "3.000000",
  validity_days: 20,
  valid_until: "2026-10-03",
  subtotal_amount: "950.000000",
  tax_amount: "171.000000",
  total_amount: "1121.000000",
  lines: [
    {
      id: 1,
      product_name: "Plato hondo",
      quantity: 100,
      length_cm: "22.000000",
      width_cm: "22.000000",
      height_cm: "5.000000",
      client_observation: "Azul cobalto",
      unit_price: "9.500000",
      line_subtotal: "950.000000",
      line_tax: "171.000000",
      line_total: "1121.000000",
    },
  ],
};

type Ruta = (url: string, init: RequestInit) => Response | undefined;

function mockV2(detalle: object, extra: Ruta = () => undefined) {
  return mockFetch((url, init = {}) => {
    const propia = extra(url, init);
    if (propia) return propia;
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: USER });
    if (url.includes("/confirmation-preview")) return jsonResponse(200, PREVIEW);
    if (url.includes("/history")) return jsonResponse(200, []);
    if (url.includes("/quoter-v2/workers")) return jsonResponse(200, V2_WORKERS);
    if (url.includes("/quoter-v2/techniques")) return jsonResponse(200, V2_TECHNIQUES);
    if (url.includes("/labor") || url.includes("/planning")) {
      return jsonResponse(200, V2_LABOR_PAGE);
    }
    if (url.includes("/illustration")) return jsonResponse(200, V2_ILLUSTRATION);
    if (url.includes("/pricing")) return jsonResponse(200, V2_PRICING);
    if (url.includes("/firing")) return jsonResponse(200, V2_FIRING);
    if (/\/quotations-v2\/\d+\/products/.test(url)) {
      return jsonResponse(200, { items: [], materials_cost: "0" });
    }
    if (url.includes("/products")) return jsonResponse(200, { items: [], total: 0 });
    if (/\/quotations-v2\/\d+$/.test(url.split("?")[0] ?? "")) return jsonResponse(200, detalle);
    if (url.includes("/quoter-v2/")) return jsonResponse(200, { items: [] });
    return jsonResponse(200, { items: [], total: 0 });
  });
}

describe("estado de la cotización V2 (Fase 010H)", () => {
  it("una emitida dice su estado y su vigencia con palabras", async () => {
    mockV2(EMITIDA);
    renderApp(["/cotizador-v2/7/resumen"]);

    const ciclo = await screen.findByTestId("v2-ciclo-de-vida");
    expect(within(ciclo).getByTestId("v2-estado-efectivo")).toHaveTextContent("Emitida");
    expect(within(ciclo).getByTestId("v2-valida-hasta")).toHaveTextContent(
      "Válida hasta: 30/09/2026",
    );
    // La fecha de emisión es la de Lima, no la de UTC.
    expect(within(ciclo).getByText(/Emitida el 10\/09\/2026 por Ana Emisora/)).toBeInTheDocument();
    expect(within(ciclo).getByRole("button", { name: "Descargar PDF" })).toBeInTheDocument();
    expect(within(ciclo).getByRole("button", { name: "Enviar a producción" })).toBeInTheDocument();
    expect(within(ciclo).queryByRole("button", { name: /duplicar/i })).not.toBeInTheDocument();
  });

  it("una vencida lo dice en texto y ofrece duplicar, no pasar a producción", async () => {
    mockV2({ ...EMITIDA, effective_status: "EXPIRED" });
    renderApp(["/cotizador-v2/7/resumen"]);

    const banda = await screen.findByTestId("v2-banda-vencida");
    expect(banda).toHaveTextContent("COTIZACIÓN VENCIDA");
    const ciclo = screen.getByTestId("v2-ciclo-de-vida");
    expect(within(ciclo).getByTestId("v2-estado-efectivo")).toHaveTextContent("Vencida");
    expect(
      within(ciclo).getByRole("button", { name: "Duplicar y actualizar precios" }),
    ).toBeInTheDocument();
    expect(within(ciclo).queryByRole("button", { name: /reabrir/i })).not.toBeInTheDocument();
    expect(
      within(ciclo).queryByRole("button", { name: "Enviar a producción" }),
    ).not.toBeInTheDocument();
  });

  it("con un borrador duplicado ya abierto, ofrece ir a él en vez de duplicar otra vez", async () => {
    mockV2({ ...EMITIDA, effective_status: "EXPIRED", open_duplicate_id: 12 });
    renderApp(["/cotizador-v2/7/resumen"]);

    const enlace = await screen.findByRole("link", { name: "Abrir la cotización duplicada" });
    expect(enlace).toHaveAttribute("href", "/cotizador-v2/12");
  });

  it("duplicar navega a la cotización NUEVA y enseña lo que no se pudo traer", async () => {
    const user = userEvent.setup();
    const NUEVA = { ...BASE, id: 12, code: "CTZ-V2-2026-000012", duplicated_from_id: 7 };
    const fetchSpy = mockV2({ ...EMITIDA, effective_status: "EXPIRED" }, (url, init) => {
      if (url.endsWith("/quotations-v2/7/duplicate") && init.method === "POST") {
        return jsonResponse(201, {
          quotation: NUEVA,
          created: true,
          warnings: [{ code: "V2_DUPLICATE_CUSTOMER_UNAVAILABLE", name: "Cliente viejo" }],
        });
      }
      if (/\/quotations-v2\/12$/.test(url)) return jsonResponse(200, NUEVA);
      return undefined;
    });
    renderApp(["/cotizador-v2/7/resumen"]);

    await user.click(await screen.findByRole("button", { name: "Duplicar y actualizar precios" }));

    const avisos = await screen.findByTestId("v2-avisos-duplicacion");
    expect(avisos).toHaveTextContent(/se recalcularon con la configuración de hoy/i);
    expect(avisos).toHaveTextContent("El cliente está archivado: elija uno nuevo. (Cliente viejo)");
    expect(avisos).not.toHaveTextContent("V2_");
    expect(await screen.findByText("CTZ-V2-2026-000012")).toBeInTheDocument();
    const posts = fetchSpy.mock.calls.filter(
      ([url, init]) =>
        String(url).includes("/duplicate") && (init as RequestInit | undefined)?.method === "POST",
    );
    expect(posts).toHaveLength(1);
  });

  it("lista para producción no ofrece otra transición", async () => {
    mockV2({
      ...EMITIDA,
      effective_status: "READY_FOR_PRODUCTION",
      production_handoff: {
        id: 1,
        v2_quotation_id: 7,
        status: "READY_FOR_PRODUCTION",
        created_at: "2026-09-12T15:00:00Z",
        created_by_name: "Ana Emisora",
      },
    });
    renderApp(["/cotizador-v2/7/resumen"]);

    expect(await screen.findByTestId("v2-lista-produccion")).toHaveTextContent(
      /no se descontó inventario/i,
    );
    const ciclo = screen.getByTestId("v2-ciclo-de-vida");
    expect(
      within(ciclo).queryByRole("button", { name: "Enviar a producción" }),
    ).not.toBeInTheDocument();
    expect(within(ciclo).queryByRole("button", { name: /anular/i })).not.toBeInTheDocument();
  });

  it("enviar a producción avisa que no consume inventario y manda UNA petición", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockV2(EMITIDA, (url, init) => {
      if (url.endsWith("/send-to-production") && init.method === "POST") {
        return jsonResponse(201, {
          handoff: {
            id: 1,
            v2_quotation_id: 7,
            status: "READY_FOR_PRODUCTION",
            created_at: "2026-09-12T15:00:00Z",
            created_by_name: "Ana",
          },
          created: true,
        });
      }
      return undefined;
    });
    renderApp(["/cotizador-v2/7/resumen"]);

    await user.click(await screen.findByRole("button", { name: "Enviar a producción" }));
    const dialogo = await screen.findByRole("dialog", { name: "Enviar a producción" });
    expect(dialogo).toHaveTextContent(/no se descuenta pasta ni esmalte/i);
    await user.click(within(dialogo).getByRole("button", { name: "Enviar a producción" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Enviar a producción" })).not.toBeInTheDocument(),
    );
    const posts = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/send-to-production"),
    );
    expect(posts).toHaveLength(1);
  });
});

describe("anular, PDF e historial (Fase 010H)", () => {
  it("anular pide confirmación, manda el motivo y el foco entra en el diálogo", async () => {
    const user = userEvent.setup();
    const cuerpos: string[] = [];
    mockV2(EMITIDA, (url, init) => {
      if (url.endsWith("/cancel") && init.method === "POST") {
        cuerpos.push(String(init.body));
        return jsonResponse(200, {
          ...EMITIDA,
          status: "CANCELLED",
          effective_status: "CANCELLED",
          cancelled_at: "2026-09-12T15:00:00Z",
          cancel_reason: "Cliente desistió",
        });
      }
      return undefined;
    });
    renderApp(["/cotizador-v2/7/resumen"]);

    await user.click(await screen.findByRole("button", { name: "Anular cotización" }));
    const dialogo = await screen.findByRole("dialog", { name: "Anular cotización" });
    expect(dialogo).toHaveTextContent(/conserva sus valores y su PDF/i);
    expect(dialogo.contains(document.activeElement)).toBe(true);
    await user.type(within(dialogo).getByLabelText(/motivo/i), "Cliente desistió");
    await user.click(within(dialogo).getByRole("button", { name: "Anular cotización" }));

    await waitFor(() => expect(cuerpos).toHaveLength(1));
    expect(JSON.parse(cuerpos[0] ?? "{}")).toEqual({ reason: "Cliente desistió" });
  });

  it("Escape cierra el diálogo y devuelve el foco al botón que lo abrió", async () => {
    const user = userEvent.setup();
    mockV2(EMITIDA);
    renderApp(["/cotizador-v2/7/resumen"]);

    const boton = await screen.findByRole("button", { name: "Enviar a producción" });
    await user.click(boton);
    await screen.findByRole("dialog", { name: "Enviar a producción" });
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Enviar a producción" })).not.toBeInTheDocument(),
    );
    expect(document.activeElement).toBe(boton);
  });

  it("descargar PDF pide el binario al backend y lo entrega con su nombre", async () => {
    const user = userEvent.setup();
    const crear = vi.fn(() => "blob:greda-pdf");
    const revocar = vi.fn();
    // jsdom no implementa object URLs ni la navegación de un enlace de descarga.
    const originales = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };
    URL.createObjectURL = crear;
    URL.revokeObjectURL = revocar;
    const clic = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const fetchSpy = mockV2(EMITIDA, (url) => {
      if (url.endsWith("/quotations-v2/7/pdf")) {
        return new Response(new Blob(["%PDF-1.7"]), {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": 'attachment; filename="CTZ-V2-2026-000007.pdf"',
          },
        });
      }
      return undefined;
    });
    renderApp(["/cotizador-v2/7/resumen"]);

    await user.click(await screen.findByRole("button", { name: "Descargar PDF" }));

    try {
      await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
      expect(clic).toHaveBeenCalledTimes(1);
      expect(
        fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/quotations-v2/7/pdf")),
      ).toHaveLength(1);
    } finally {
      clic.mockRestore();
      URL.createObjectURL = originales.crear;
      URL.revokeObjectURL = originales.revocar;
    }
  });

  it("un PDF que falla se explica sin enseñar el código", async () => {
    const user = userEvent.setup();
    mockV2(EMITIDA, (url) => {
      if (url.endsWith("/pdf")) return errorResponse(409, "V2_QUOTATION_PDF_NOT_ISSUED");
      return undefined;
    });
    renderApp(["/cotizador-v2/7/resumen"]);

    await user.click(await screen.findByRole("button", { name: "Descargar PDF" }));
    const alerta = await within(screen.getByTestId("v2-ciclo-de-vida")).findByRole("alert");
    expect(alerta).toHaveTextContent(/no tiene documento/i);
    expect(alerta).not.toHaveTextContent("V2_");
  });

  it("el historial de una emitida dice quién hizo qué y cuándo", async () => {
    mockV2(EMITIDA, (url) => {
      if (url.endsWith("/history")) {
        return jsonResponse(200, [
          { event: "CREATED", at: "2026-09-10T15:00:00Z", user_name: "Ana", details: {} },
          {
            event: "CONFIRMED",
            at: "2026-09-11T02:30:00Z",
            user_name: "Ana Emisora",
            details: { code: "CTZ-V2-2026-000007" },
          },
          {
            event: "DUPLICATED",
            at: "2026-10-05T15:00:00Z",
            user_name: "Luis",
            details: { new_code: "CTZ-V2-2026-000012" },
          },
        ]);
      }
      return undefined;
    });
    renderApp(["/cotizador-v2/7/resumen"]);

    const lista = await screen.findByTestId("v2-historial");
    await waitFor(() => expect(within(lista).getAllByRole("listitem")).toHaveLength(3));
    expect(lista).toHaveTextContent("Emitida · 10/09/2026 · Ana Emisora");
    expect(lista).toHaveTextContent("Duplicada en una cotización nueva · 05/10/2026 · Luis · CTZ-V2-2026-000012");
    expect(lista).not.toHaveTextContent(/CONFIRMED|DUPLICATED/);
  });

  it("si el borrador duplicado ya existía, no dice que se creó uno nuevo", async () => {
    const user = userEvent.setup();
    const ABIERTA = { ...BASE, id: 12, code: "CTZ-V2-2026-000012", duplicated_from_id: 7 };
    mockV2({ ...EMITIDA, effective_status: "EXPIRED" }, (url, init) => {
      if (url.endsWith("/duplicate") && init.method === "POST") {
        return jsonResponse(200, { quotation: ABIERTA, created: false, warnings: [] });
      }
      if (/\/quotations-v2\/12$/.test(url)) return jsonResponse(200, ABIERTA);
      return undefined;
    });
    renderApp(["/cotizador-v2/7/resumen"]);

    await user.click(await screen.findByRole("button", { name: "Duplicar y actualizar precios" }));
    const avisos = await screen.findByTestId("v2-avisos-duplicacion");
    expect(avisos).toHaveTextContent(/ya había un borrador duplicado/i);
    expect(avisos).not.toHaveTextContent(/cotización nueva creada/i);
  });

  it("sin estado efectivo (backend anterior) lo dice con palabras y no ofrece duplicar", async () => {
    const { effective_status: _omitido, ...sinEstado } = EMITIDA;
    mockV2(sinEstado);
    renderApp(["/cotizador-v2/7/resumen"]);

    const ciclo = await screen.findByTestId("v2-ciclo-de-vida");
    expect(within(ciclo).getByTestId("v2-estado-efectivo")).toHaveTextContent("Emitida");
    for (const accion of [/duplicar/i, /enviar a producción/i, /anular/i, /descargar pdf/i]) {
      expect(within(ciclo).queryByRole("button", { name: accion })).not.toBeInTheDocument();
    }
  });
});

describe("emitir una cotización V2 (Fase 010H)", () => {
  it("el diálogo enseña el resumen del backend y avisa que se congela", async () => {
    const user = userEvent.setup();
    mockV2(BASE);
    renderApp(["/cotizador-v2/7/resumen"]);

    await user.click(await screen.findByRole("button", { name: "Confirmar y emitir" }));
    const dialogo = await screen.findByRole("dialog", { name: /confirmar y emitir/i });

    expect(await within(dialogo).findByTestId("emision-total")).toHaveTextContent("S/ 1121.00");
    expect(within(dialogo).getByTestId("emision-vigencia")).toHaveTextContent("03/10/2026");
    expect(within(dialogo).getByText("Plato hondo")).toBeInTheDocument();
    // Lo que el PDF dirá del cliente y las condiciones también se revisa aquí.
    expect(within(dialogo).getByTestId("emision-datos-cliente")).toHaveTextContent(
      "RUC: 20600000001 · Jr. Barro 456, Lima",
    );
    expect(within(dialogo).getByTestId("emision-condiciones")).toHaveTextContent(
      "Transferencia bancaria.",
    );
    expect(within(dialogo).getByTestId("emision-aviso-congelado")).toHaveTextContent(
      "Al confirmar, los valores comerciales quedarán congelados.",
    );
    // Nada interno en lo que se va a enviar al cliente.
    expect(dialogo).not.toHaveTextContent(/costo real|ganancia|margen|gas real/i);
  });

  it("confirmar manda la huella del resumen revisado", async () => {
    const user = userEvent.setup();
    const cuerpos: string[] = [];
    mockV2(BASE, (url, init) => {
      if (url.endsWith("/confirm") && init.method === "POST") {
        cuerpos.push(String(init.body));
        return jsonResponse(200, EMITIDA);
      }
      return undefined;
    });
    renderApp(["/cotizador-v2/7/resumen"]);

    await user.click(await screen.findByRole("button", { name: "Confirmar y emitir" }));
    const dialogo = await screen.findByRole("dialog", { name: /confirmar y emitir/i });
    await within(dialogo).findByTestId("emision-total");
    await user.click(within(dialogo).getByRole("button", { name: "Confirmar y emitir" }));

    await waitFor(() => expect(cuerpos).toHaveLength(1));
    expect(JSON.parse(cuerpos[0] ?? "{}")).toEqual({ expected_fingerprint: "a".repeat(64) });
  });

  it("con bloqueos no deja confirmar y los explica en palabras", async () => {
    const user = userEvent.setup();
    mockV2(BASE, (url) => {
      if (url.includes("/confirmation-preview")) {
        return jsonResponse(200, {
          ...PREVIEW,
          can_confirm: false,
          blockers: [{ code: "V2_CONFIRM_KILN_REQUIRED", line_id: null }],
        });
      }
      return undefined;
    });
    renderApp(["/cotizador-v2/7/resumen"]);

    await user.click(await screen.findByRole("button", { name: "Confirmar y emitir" }));
    const dialogo = await screen.findByRole("dialog", { name: /confirmar y emitir/i });
    const bloqueos = await within(dialogo).findByTestId("emision-bloqueos");
    expect(bloqueos).toHaveTextContent("Falta elegir el horno.");
    expect(bloqueos).not.toHaveTextContent("V2_");
    expect(within(dialogo).getByRole("button", { name: "Confirmar y emitir" })).toBeDisabled();
  });

  it("si otra persona cambió la cotización, recarga el resumen y lo dice", async () => {
    const user = userEvent.setup();
    let previews = 0;
    mockV2(BASE, (url, init) => {
      if (url.includes("/confirmation-preview")) {
        previews += 1;
        return jsonResponse(200, {
          ...PREVIEW,
          fingerprint: (previews === 1 ? "a" : "b").repeat(64),
          total_amount: previews === 1 ? "1121.000000" : "1345.200000",
        });
      }
      if (url.endsWith("/confirm") && init.method === "POST") {
        return errorResponse(409, "V2_QUOTATION_CHANGED");
      }
      return undefined;
    });
    renderApp(["/cotizador-v2/7/resumen"]);

    await user.click(await screen.findByRole("button", { name: "Confirmar y emitir" }));
    const dialogo = await screen.findByRole("dialog", { name: /confirmar y emitir/i });
    await within(dialogo).findByTestId("emision-total");
    await user.click(within(dialogo).getByRole("button", { name: "Confirmar y emitir" }));

    expect(await within(dialogo).findByTestId("emision-cambio")).toHaveTextContent(
      /cambió mientras usted revisaba/i,
    );
    await waitFor(() =>
      expect(within(dialogo).getByTestId("emision-total")).toHaveTextContent("S/ 1345.20"),
    );
  });
});

describe("mensajes del ciclo de vida (Fase 010H)", () => {
  // La lista EXACTA de códigos que emite el backend (app/services/quoter_v2_lifecycle.py
  // y app/services/quoter_v2_pdf.py). Un código nuevo sin traducir rompe aquí.
  const BLOQUEOS = [
    "V2_CONFIRM_CUSTOMER_REQUIRED",
    "V2_CONFIRM_CUSTOMER_INACTIVE",
    "V2_CONFIRM_NO_LINES",
    "V2_CONFIRM_LINE_PRODUCT_REQUIRED",
    "V2_CONFIRM_LINE_QUANTITY_REQUIRED",
    "V2_CONFIRM_LINE_BODY_MATERIAL_REQUIRED",
    "V2_CONFIRM_LINE_BODY_WEIGHT_REQUIRED",
    "V2_CONFIRM_LINE_PRICE_REQUIRED",
    "V2_CONFIRM_FACTOR_REQUIRED",
    "V2_CONFIRM_FACTOR_OUT_OF_RANGE",
    "V2_CONFIRM_TAX_REQUIRED",
    "V2_CONFIRM_ROUNDING_REQUIRED",
    "V2_CONFIRM_CURRENCY_REQUIRED",
    "V2_CONFIRM_EXCHANGE_RATE_REQUIRED",
    "V2_CONFIRM_VALIDITY_INVALID",
    "V2_CONFIRM_WORK_DAYS_REQUIRED",
    "V2_CONFIRM_KILN_REQUIRED",
    "V2_CONFIRM_TOTAL_REQUIRED",
  ];
  const DUPLICACION = [
    "V2_DUPLICATE_CUSTOMER_UNAVAILABLE",
    "V2_DUPLICATE_PRODUCT_UNAVAILABLE",
    "V2_DUPLICATE_BODY_MATERIAL_UNAVAILABLE",
    "V2_DUPLICATE_GLAZE_MATERIAL_UNAVAILABLE",
    "V2_DUPLICATE_KILN_UNAVAILABLE",
    "V2_DUPLICATE_LABOR_UNAVAILABLE",
    "V2_DUPLICATE_ILLUSTRATION_UNAVAILABLE",
    "V2_DUPLICATE_PLANNING_UNAVAILABLE",
  ];
  const ERRORES = [
    "V2_QUOTATION_CHANGED",
    "V2_QUOTATION_INCOMPLETE",
    "V2_QUOTATION_ALREADY_ISSUED",
    "V2_QUOTATION_NOT_CONFIRMABLE",
    "V2_QUOTATION_NOT_CANCELLABLE",
    "V2_QUOTATION_NOT_DUPLICABLE",
    "V2_QUOTATION_NOT_SENDABLE",
    "V2_QUOTATION_EXPIRED",
    "V2_QUOTATION_PDF_DRAFT_BLOCKED",
    "V2_QUOTATION_PDF_NOT_ISSUED",
  ];

  it("cada bloqueo de emisión tiene su frase", () => {
    for (const codigo of BLOQUEOS) {
      expect(BLOQUEOS_DE_EMISION[codigo], codigo).toBeDefined();
      expect(describirBloqueo(codigo).mensaje).not.toMatch(/V2_/);
    }
  });

  it("cada aviso de duplicación tiene su frase", () => {
    for (const codigo of DUPLICACION) {
      expect(AVISOS_DE_DUPLICACION[codigo], codigo).toBeDefined();
      expect(describirAvisoDeDuplicacion(codigo, null)).not.toMatch(/V2_/);
    }
  });

  it("cada error nuevo del backend se explica sin enseñar el código", () => {
    for (const codigo of ERRORES) {
      const texto = describeError(new ApiError(codigo, "mensaje del backend", 409));
      expect(texto, codigo).not.toMatch(/V2_|mensaje del backend/);
    }
  });

  it("un código desconocido no se muestra crudo", () => {
    expect(describirBloqueo("V2_CONFIRM_ALGO_NUEVO").mensaje).not.toMatch(/V2_/);
    expect(describirAvisoDeDuplicacion("V2_DUPLICATE_ALGO", null)).not.toMatch(/V2_/);
    expect(describirEvento("ALGO_NUEVO")).not.toMatch(/ALGO_NUEVO/);
  });
});
