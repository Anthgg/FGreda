import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  SOLO_QUEMA,
  SOLO_QUEMA_LISTA,
  SOLO_QUEMA_PREVIEW,
} from "@/test/soloQuemaFixtures";
import { csrfResponse, jsonResponse, mockFetch, renderApp } from "@/test/utils";

/**
 * Solo Quema en pantalla (Fase 010K).
 *
 * Lo que estas pruebas protegen no es el maquetado: son las cuatro confusiones
 * que un módulo de quema invita a cometer.
 *
 * 1. **enseñarle al cliente lo que es del taller.** El gas, la ocupación, el
 *    factor y el margen son internos. La vista del cliente lleva piezas,
 *    servicio y tres importes, y nada más;
 * 2. **convertir el comparador en un selector.** La tabla dice lo que costaría
 *    el mismo pedido en el otro horno. El horno elegido no se mueve solo;
 * 3. **recalcular en el navegador.** Todos los importes llegan del backend. Si
 *    la pantalla multiplicara por su cuenta habría dos aritméticas —una de
 *    ellas de coma flotante— y nadie sabría cuál manda;
 * 4. **tratar el factor como el de fabricación.** Aquí va de ×1,00 a ×2,00: lo
 *    que se vende es horno, no una pieza que el taller hizo y puede rajarse.
 */

const USER = {
  id: "11111111-2222-3333-4444-555555555555",
  email: "admin@empresa.com",
  display_name: "Administrador",
  role: "ADMIN" as const,
};

function mockSoloQuema(
  overrides: { detalle?: () => Response; preview?: () => Response } = {},
) {
  const puesto: RequestInit[] = [];
  const mock = mockFetch((url, init) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: USER });
    if (url.includes("/quoter-v2/workers")) return jsonResponse(200, { items: [] });
    if (url.includes("/quoter-v2/techniques")) return jsonResponse(200, { items: [] });
    if (url.includes("/quoter-v2/materials")) return jsonResponse(200, { items: [] });
    if (url.includes("/partners")) return jsonResponse(200, { items: [], total: 0 });
    if (url.includes("/firing-quotations-v2/5/preview")) {
      return overrides.preview ? overrides.preview() : jsonResponse(200, SOLO_QUEMA_PREVIEW);
    }
    if (url.includes("/firing-quotations-v2/5")) {
      if (init?.method === "PUT" || init?.method === "POST") puesto.push(init);
      return overrides.detalle ? overrides.detalle() : jsonResponse(200, SOLO_QUEMA);
    }
    if (url.includes("/firing-quotations-v2")) return jsonResponse(200, SOLO_QUEMA_LISTA);
    if (url.includes("/products")) return jsonResponse(200, { items: [], total: 0 });
    return jsonResponse(200, {});
  });
  return { mock, puesto };
}

describe("Solo Quema (Fase 010K)", () => {
  it("lista los servicios de quema con su código propio", async () => {
    mockSoloQuema();

    renderApp(["/solo-quema"]);

    const listado = await screen.findByTestId("listado-solo-quema");
    expect(within(listado).getByText("Q-V2-2026-000001")).toBeInTheDocument();
    expect(within(listado).getByText("Ana Quispe")).toBeInTheDocument();
  });

  it("enseña la ocupación, las hornadas y los dos totales que calculó el backend", async () => {
    mockSoloQuema();

    renderApp(["/solo-quema/5"]);

    const panel = await screen.findByTestId("panel-quema-solo");
    // 133 100 cm³ en un horno de 17 000: ocho hornadas y 7,829412 facturadas.
    expect(within(panel).getAllByText("782.941176 %").length).toBeGreaterThan(0);
    expect(within(panel).getByText("7.829411764706 hornadas")).toBeInTheDocument();
    expect(within(panel).getAllByText("3523.235294").length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("822.088235").length).toBeGreaterThan(0);
  });

  it("compara los dos hornos en las dos modalidades sin cambiar el elegido", async () => {
    const { puesto } = mockSoloQuema();

    renderApp(["/solo-quema/5"]);

    const tabla = await screen.findByTestId("comparacion-hornos");
    expect(within(tabla).getByText("Horno grande")).toBeInTheDocument();
    // Compartida y exclusiva, del grande: 1264,45 y 1900,00.
    expect(within(tabla).getByText("1264.450000")).toBeInTheDocument();
    expect(within(tabla).getByText("1900.000000")).toBeInTheDocument();
    // Y el horno elegido sigue siendo el chico: comparar no guarda nada.
    expect(within(tabla).getByText("(elegido)")).toBeInTheDocument();
    expect(puesto).toHaveLength(0);
  });

  it("sugiere el horno más barato y dice que no se cambia solo", async () => {
    mockSoloQuema();

    renderApp(["/solo-quema/5"]);

    const sugerencia = await screen.findByTestId("sugerencia-horno");
    expect(sugerencia).toHaveTextContent("Horno grande");
    expect(sugerencia).toHaveTextContent("2258.785294");
    expect(sugerencia).toHaveTextContent(/el horno no se cambia solo/i);
  });

  it("separa lo que paga el cliente de lo que le cuesta al taller", async () => {
    mockSoloQuema();

    renderApp(["/solo-quema/5"]);

    const panel = await screen.findByTestId("panel-precio-quema");
    expect(within(panel).getByText(/lo que paga el cliente/i)).toBeInTheDocument();
    const interno = within(panel).getByTestId("lectura-interna");
    // El costo real, la ganancia y el margen viven en el bloque interno.
    expect(within(interno).getByText("822.088235")).toBeInTheDocument();
    expect(within(interno).getByText("2701.411765")).toBeInTheDocument();
    // Y el total del cliente, fuera de él.
    expect(within(panel).getAllByText("4157.730000").length).toBeGreaterThan(0);
  });

  it("dice que el factor va de 1,00 a 2,00 y que el gas no entra en la base", async () => {
    mockSoloQuema();

    renderApp(["/solo-quema/5"]);

    const panel = await screen.findByTestId("panel-precio-quema");
    expect(within(panel).getByText(/entre 1\.00 y 2\.00/i)).toBeInTheDocument();
    expect(within(panel).getByText(/el gas no entra: es costo, no precio/i)).toBeInTheDocument();
  });

  it("la vista del cliente no lleva ocupación, gas, factor ni margen", async () => {
    mockSoloQuema();

    renderApp(["/solo-quema/5"]);

    const emision = await screen.findByTestId("panel-emision-quema");
    const vista = within(emision).getByTestId("vista-cliente");
    expect(within(vista).getByText("Taza de Ana")).toBeInTheDocument();
    expect(within(vista).getByText("100")).toBeInTheDocument();
    // Ni la ocupación ni el gas ni la ganancia aparecen en lo que se le enseña.
    expect(within(emision).queryByText("782.941176 %")).not.toBeInTheDocument();
    expect(within(emision).queryByText("822.088235")).not.toBeInTheDocument();
    expect(within(emision).queryByText("2701.411765")).not.toBeInTheDocument();
    // Y sí los tres importes del documento.
    expect(within(emision).getByText("3523.500000")).toBeInTheDocument();
    expect(within(emision).getByText("634.230000")).toBeInTheDocument();
    expect(within(emision).getByText("4157.730000")).toBeInTheDocument();
  });

  it("emite mandando la huella de lo que se estaba viendo", async () => {
    const { puesto } = mockSoloQuema();

    renderApp(["/solo-quema/5"]);

    const emision = await screen.findByTestId("panel-emision-quema");
    await userEvent.click(within(emision).getByRole("button", { name: /emitir/i }));

    const emitido = puesto.find((init) => String(init.body).includes("expected_fingerprint"));
    expect(emitido).toBeDefined();
    expect(String(emitido?.body)).toContain("huella-de-prueba");
  });

  it("no deja emitir cuando el backend informa bloqueos, y los nombra", async () => {
    mockSoloQuema({
      preview: () =>
        jsonResponse(200, {
          ...SOLO_QUEMA_PREVIEW,
          can_confirm: false,
          blockers: [
            { code: "V2_FQ_NO_KILN", line_id: null },
            { code: "V2_FQ_LINE_WITHOUT_DIMENSIONS", line_id: 1 },
          ],
        }),
    });

    renderApp(["/solo-quema/5"]);

    const bloqueos = await screen.findByTestId("bloqueos-quema");
    expect(within(bloqueos).getByText(/falta elegir el horno/i)).toBeInTheDocument();
    expect(within(bloqueos).getByText(/una pieza no tiene medidas/i)).toBeInTheDocument();
    const emision = screen.getByTestId("panel-emision-quema");
    expect(within(emision).getByRole("button", { name: /emitir/i })).toBeDisabled();
  });

  it("una vez emitida no se edita: se descarga, se anula o se duplica", async () => {
    mockSoloQuema({
      detalle: () =>
        jsonResponse(200, { ...SOLO_QUEMA, status: "CONFIRMED", effective_status: "ISSUED" }),
      preview: () =>
        jsonResponse(200, {
          ...SOLO_QUEMA_PREVIEW,
          status: "CONFIRMED",
          effective_status: "ISSUED",
          can_confirm: false,
        }),
    });

    renderApp(["/solo-quema/5"]);

    const ficha = await screen.findByTestId("ficha-solo-quema");
    expect(within(ficha).getByText(/ya emitida: no se edita/i)).toBeInTheDocument();
    const emision = within(ficha).getByTestId("panel-emision-quema");
    expect(within(emision).getByRole("button", { name: /descargar pdf/i })).toBeInTheDocument();
    expect(within(emision).getByRole("button", { name: /anular/i })).toBeInTheDocument();
    expect(within(emision).getByRole("button", { name: /duplicar/i })).toBeInTheDocument();
    expect(within(emision).queryByRole("button", { name: /emitir/i })).not.toBeInTheDocument();
  });

  it("el vidriado está apagado y no pide nada cuando la pieza ya viene esmaltada", async () => {
    mockSoloQuema();

    renderApp(["/solo-quema/5"]);

    const panel = await screen.findByTestId("panel-vidriado-quema");
    expect(within(panel).queryByText(/gramos de esmalte/i)).not.toBeInTheDocument();
    expect(
      within(panel).getByText(/si el cliente trae la pieza ya esmaltada/i),
    ).toBeInTheDocument();
  });

  it("marca el costo del esmalte escrito a mano como propio de este servicio", async () => {
    mockSoloQuema({
      detalle: () =>
        jsonResponse(200, {
          ...SOLO_QUEMA,
          glaze_enabled: true,
          glaze_grams: "500.000000",
          glaze_cost_source: "MANUAL",
          glaze_manual_cost_per_gram: "0.080000",
          glaze_cost_per_gram: "0.080000",
          glaze_material_cost: "40.000000",
        }),
    });

    renderApp(["/solo-quema/5"]);

    const panel = await screen.findByTestId("panel-vidriado-quema");
    // Sale dos veces: en el desplegable de origen y en el resumen de abajo.
    expect(within(panel).getAllByText("Costo escrito a mano").length).toBeGreaterThan(0);
    expect(within(panel).getByText(/nunca cambia el maestro/i)).toBeInTheDocument();
    expect(within(panel).getAllByText("40.000000").length).toBeGreaterThan(0);
  });

  it("dice que la pieza sin medidas no ocuparía horno en vez de callarlo", async () => {
    mockSoloQuema();

    renderApp(["/solo-quema/5"]);

    const piezas = await screen.findByTestId("panel-piezas-quema");
    expect(
      within(piezas).getAllByText(/no ocuparía horno y el precio saldría corto/i).length,
    ).toBeGreaterThan(0);
  });

  it("no inventa una ficha cuando la dirección no es un número", async () => {
    mockSoloQuema();

    renderApp(["/solo-quema/loquesea"]);

    expect(await screen.findByText(/ese servicio de quema no existe/i)).toBeInTheDocument();
    expect(screen.queryByText(/nuevo servicio de quema/i)).not.toBeInTheDocument();
  });
});

describe("Solo Quema en el menú (Fase 010K)", () => {
  it("aparece como módulo propio y no dentro de Quemas", async () => {
    mockSoloQuema();

    renderApp(["/solo-quema"]);

    await screen.findByTestId("listado-solo-quema");
    const enlaces = screen.getAllByRole("link", { name: /solo quema/i });
    expect(enlaces.length).toBeGreaterThan(0);
    expect(enlaces[0]).toHaveAttribute("href", "/solo-quema");
  });
});

// `URL.createObjectURL` no existe en jsdom: la descarga del PDF se prueba en
// los E2E de revisión, donde hay un navegador de verdad.
vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
