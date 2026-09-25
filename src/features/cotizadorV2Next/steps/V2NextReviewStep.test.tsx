import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { errorResponse, jsonResponse, renderApp } from "@/test/utils";
import { COTIZACION, mockShell, resumenDeEmision } from "@/test/v2next/shellFixtures";
import type { V2PreviewLine } from "@/types/quoterV2";

/**
 * «Revisar y emitir» del rediseño, montado en el shell (010O.11).
 *
 * Lo que se protege: que la lista de pasos diga lo mismo que el backend, que
 * el documento sea el del resumen de emisión, y que emitir mande la huella de
 * ESE resumen —y, si cambió, que se diga en vez de emitir algo no revisado—.
 */

const LINEA: V2PreviewLine = {
  id: 11,
  product_name: "Plato palta",
  quantity: 20,
  length_cm: "18.000000",
  width_cm: "12.000000",
  height_cm: "3.000000",
  client_observation: "Acabado mate",
  unit_price: "177.000000",
  line_subtotal: "3540.000000",
  line_tax: "637.200000",
  line_total: "4177.200000",
};

async function abrirRevision(opciones: Parameters<typeof mockShell>[0] = {}) {
  const espia = mockShell(opciones);
  renderApp(["/cotizador-v2/7/resumen"]);
  const paso = await screen.findByTestId("v2next-paso-revisar");
  return { espia, paso: within(paso) };
}

function emisiones(espia: ReturnType<typeof mockShell>) {
  return espia.mock.calls
    .filter(
      ([url, init]) =>
        String(url).endsWith("/quotations-v2/7/confirm") &&
        (init as RequestInit | undefined)?.method === "POST",
    )
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
}

describe("«Revisar y emitir» del rediseño", () => {
  it("la lista de pasos dice lo que el backend bloquea, con un atajo al paso", async () => {
    const user = userEvent.setup();
    const { paso } = await abrirRevision({
      bloqueos: [{ code: "V2_CONFIRM_KILN_REQUIRED", line_id: null }],
    });
    const lista = await paso.findByTestId("v2next-checklist");
    const horno = within(lista).getByText(/5\. Horno/).closest("li") as HTMLElement;
    expect(horno).toHaveTextContent("Falta 1 dato");
    expect(within(lista).getByText(/1\. Cliente/).closest("li")).toHaveAttribute(
      "data-situacion",
      "listo",
    );

    await user.click(within(horno).getByRole("button", { name: /Completar/ }));
    expect(await screen.findByRole("heading", { level: 2, name: "Horno" })).toBeInTheDocument();
  });

  it("con bloqueos no deja emitir y dice cuántos datos faltan", async () => {
    const { paso } = await abrirRevision({
      bloqueos: [
        { code: "V2_CONFIRM_KILN_REQUIRED", line_id: null },
        { code: "V2_CONFIRM_FACTOR_REQUIRED", line_id: null },
      ],
    });
    await waitFor(() =>
      expect(paso.getByText("Completa 2 datos para poder emitir.")).toBeInTheDocument(),
    );
    expect(paso.getByRole("button", { name: "Emitir cotización" })).toBeDisabled();
  });

  it("un bloqueo de configuración se dice aunque no tenga paso", async () => {
    const { paso } = await abrirRevision({
      bloqueos: [{ code: "V2_CONFIRM_TAX_REQUIRED", line_id: null }],
    });
    expect(await paso.findByTestId("v2next-bloqueos-configuracion")).toHaveTextContent(
      "no tiene IGV",
    );
  });

  it("el documento es el resumen de emisión, con medidas, observación y totales", async () => {
    const { paso } = await abrirRevision({
      extra: (url) =>
        url.includes("/confirmation-preview")
          ? jsonResponse(200, {
              ...resumenDeEmision(),
              customer_document: "RUC: 20123456789",
              conditions: "Adelanto del 50 %.",
              lines: [LINEA],
            })
          : undefined,
    });
    const documento = await paso.findByTestId("v2next-documento");
    expect(documento).toHaveTextContent(COTIZACION.code);
    expect(documento).toHaveTextContent("Cliente demo");
    expect(documento).toHaveTextContent("RUC: 20123456789");
    expect(documento).toHaveTextContent("18 × 12 × 3 cm");
    expect(documento).toHaveTextContent("Acabado mate");
    expect(documento).toHaveTextContent("S/ 177.00");
    expect(documento).toHaveTextContent("IGV 18 %");
    expect(within(documento).getByTestId("v2next-documento-total")).toHaveTextContent("S/ 4177.20");
    expect(documento).toHaveTextContent("Válida hasta el 01/10/2026 si se emite hoy · 20 días");
    expect(documento).toHaveTextContent("Adelanto del 50 %.");
  });

  it("lo que se emite lleva los datos del cliente y el pago, nunca un costo interno", async () => {
    // Heredado del diálogo de emisión anterior (010H), retirado en el corte.
    const user = userEvent.setup();
    const { paso } = await abrirRevision({
      extra: (url) =>
        url.includes("/confirmation-preview")
          ? jsonResponse(200, {
              ...resumenDeEmision(),
              customer_document: "RUC: 20600000001",
              customer_address: "Jr. Barro 456, Lima",
              payment_notes: "Transferencia bancaria.",
              lines: [LINEA],
            })
          : undefined,
    });
    const documento = await paso.findByTestId("v2next-documento");
    expect(documento).toHaveTextContent("RUC: 20600000001");
    expect(documento).toHaveTextContent("Jr. Barro 456, Lima");
    expect(documento).toHaveTextContent("Transferencia bancaria.");
    expect(documento).not.toHaveTextContent(/costo real|ganancia|margen|gas real|factor/i);

    await user.click(paso.getByRole("button", { name: "Emitir cotización" }));
    const dialogo = await screen.findByRole("dialog", { name: "¿Emitir la cotización?" });
    expect(dialogo).toHaveTextContent("los valores comerciales quedan congelados");
  });

  it("en dólares el documento va en US$", async () => {
    const { paso } = await abrirRevision({
      extra: (url) =>
        url.includes("/confirmation-preview")
          ? jsonResponse(200, {
              ...resumenDeEmision(),
              currency_code: "USD",
              currency_symbol: "US$",
              exchange_rate: "3.750000",
              total_amount: "1113.92",
            })
          : undefined,
    });
    const documento = await paso.findByTestId("v2next-documento");
    expect(within(documento).getByTestId("v2next-documento-total")).toHaveTextContent(
      "US$ 1113.92",
    );
    expect(documento).toHaveTextContent("Tipo de cambio congelado: TC 3.750");
  });

  it("emitir confirma en un diálogo y manda la huella del resumen, una vez", async () => {
    const user = userEvent.setup();
    const { espia, paso } = await abrirRevision({
      extra: (url, init) =>
        url.endsWith("/quotations-v2/7/confirm") && init.method === "POST"
          ? jsonResponse(200, { ...COTIZACION, status: "CONFIRMED", effective_status: "CONFIRMED" })
          : undefined,
    });
    await user.click(await paso.findByRole("button", { name: "Emitir cotización" }));

    const dialogo = await screen.findByRole("dialog", { name: "¿Emitir la cotización?" });
    // Por un portal: un `fixed` dentro de un `.glass-panel` quedaría encerrado en el panel.
    expect(dialogo.parentElement).toBe(document.body);
    expect(dialogo).toHaveTextContent("S/ 4177.20");
    await user.click(within(dialogo).getByRole("button", { name: "Confirmar y emitir" }));

    await waitFor(() => expect(emisiones(espia)).toEqual([{ expected_fingerprint: "a".repeat(64) }]));
  });

  it("si la cotización cambió, recarga el resumen y lo dice en vez de emitir", async () => {
    const user = userEvent.setup();
    let resumenes = 0;
    await abrirRevision({
      extra: (url, init) => {
        if (url.includes("/confirmation-preview")) {
          resumenes += 1;
          return jsonResponse(200, {
            ...resumenDeEmision(),
            fingerprint: (resumenes === 1 ? "a" : "b").repeat(64),
            total_amount: resumenes === 1 ? "4177.200000" : "4500.000000",
          });
        }
        if (url.endsWith("/confirm") && init.method === "POST") {
          return errorResponse(409, "V2_QUOTATION_CHANGED");
        }
        return undefined;
      },
    });
    await user.click(await screen.findByRole("button", { name: "Emitir cotización" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirmar y emitir" }),
    );

    expect(await screen.findByTestId("v2next-emision-cambio")).toHaveTextContent(
      /cambió mientras usted la revisaba/,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("v2next-documento-total")).toHaveTextContent("S/ 4500.00"),
    );
  });

  it("una emitida enseña su documento congelado y no ofrece emitir", async () => {
    mockShell({
      cotizacion: {
        status: "CONFIRMED",
        effective_status: "CONFIRMED",
        issued_at: "2026-09-20T10:00:00Z",
        valid_until: "2026-10-10",
      },
    });
    renderApp(["/cotizador-v2/7/resumen"]);
    expect(await screen.findByTestId("v2-documento-emitido")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Emitir cotización" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("v2next-checklist")).not.toBeInTheDocument();
  });
});
