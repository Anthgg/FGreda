import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { jsonResponse, renderApp } from "@/test/utils";
import { COTIZACION, mockShell, resumenDeEmision } from "@/test/v2next/shellFixtures";
import type { V2Quotation } from "@/types/quoterV2";

/**
 * Ciclo de vida y solo lectura en el rediseño (010O.12).
 *
 * Cada estado efectivo ofrece exactamente lo que el backend permite. La regla
 * que más importa: una cotización EMITIDA y vigente no se duplica; se anula y
 * se duplica la anulada, o se espera a que venza.
 */

const EMITIDA: Partial<V2Quotation> = {
  status: "CONFIRMED",
  effective_status: "CONFIRMED",
  issued_at: "2026-09-20T10:00:00Z",
  issued_by_name: "Ana Emisora",
  valid_until: "2026-10-10",
};

function acciones() {
  return within(screen.getByTestId("v2next-cabecera"));
}

async function abrir(cotizacion: Partial<V2Quotation>, extra?: Parameters<typeof mockShell>[0]["extra"]) {
  const espia = mockShell({ cotizacion, ...(extra ? { extra } : {}) });
  renderApp(["/cotizador-v2-next/7/resumen"]);
  await screen.findByRole("heading", { level: 2, name: "Revisar y emitir" });
  return espia;
}

describe("ciclo de vida en el rediseño", () => {
  it("el estado se pinta una vez, en la cabecera", async () => {
    await abrir(EMITIDA);
    const cabecera = screen.getByTestId("v2next-cabecera");
    expect(within(cabecera).getAllByTestId("v2-estado-efectivo")).toHaveLength(1);
    expect(within(cabecera).getByTestId("v2-estado-efectivo")).toHaveTextContent("Emitida");
  });

  it("borrador: se puede anular; ni PDF ni duplicar", async () => {
    await abrir({});
    expect(acciones().getByRole("button", { name: "Anular cotización" })).toBeInTheDocument();
    expect(acciones().queryByRole("button", { name: "Descargar PDF" })).not.toBeInTheDocument();
    expect(acciones().queryByRole("button", { name: /Duplicar/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("v2next-solo-lectura")).not.toBeInTheDocument();
  });

  it("emitida vigente: PDF, producción y anular; NUNCA duplicar", async () => {
    await abrir(EMITIDA);
    expect(acciones().getByRole("button", { name: "Descargar PDF" })).toBeInTheDocument();
    expect(acciones().getByRole("button", { name: "Enviar a producción" })).toBeInTheDocument();
    expect(acciones().getByRole("button", { name: "Anular cotización" })).toBeInTheDocument();
    expect(acciones().queryByRole("button", { name: /Duplicar/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("v2next-solo-lectura")).toHaveTextContent(
      "anúlela y duplíquela",
    );
    // Solo lectura: el pie no ofrece estado de guardado.
    expect(screen.queryByTestId("v2next-estado-guardado")).not.toBeInTheDocument();
  });

  it("vencida: banda en palabras, duplicar y anular; no producción", async () => {
    await abrir({ ...EMITIDA, effective_status: "EXPIRED" });
    expect(screen.getByTestId("v2-banda-vencida")).toHaveTextContent("COTIZACIÓN VENCIDA");
    expect(acciones().getByRole("button", { name: "Duplicar y actualizar precios" })).toBeInTheDocument();
    expect(acciones().getByRole("button", { name: "Anular cotización" })).toBeInTheDocument();
    expect(acciones().queryByRole("button", { name: "Enviar a producción" })).not.toBeInTheDocument();
  });

  it("anulada: duplicar sí, anular otra vez no", async () => {
    await abrir({ ...EMITIDA, status: "CANCELLED", effective_status: "CANCELLED" });
    expect(acciones().getByRole("button", { name: "Duplicar y actualizar precios" })).toBeInTheDocument();
    expect(acciones().queryByRole("button", { name: "Anular cotización" })).not.toBeInTheDocument();
  });

  it("duplicar lleva a la NUEVA dentro del rediseño y dice qué pasó", async () => {
    const user = userEvent.setup();
    const nueva = { ...COTIZACION, id: 12, code: "CTZ-V2-2026-000012", name: "Pedido duplicado" };
    await abrir({ ...EMITIDA, effective_status: "EXPIRED" }, (url, init) => {
      if (url.endsWith("/quotations-v2/7/duplicate") && init.method === "POST") {
        return jsonResponse(201, { quotation: nueva, created: true, warnings: [] });
      }
      if (url.endsWith("/quotations-v2/12")) return jsonResponse(200, nueva);
      return undefined;
    });
    await user.click(acciones().getByRole("button", { name: "Duplicar y actualizar precios" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Pedido duplicado" })).toBeInTheDocument();
    expect(await screen.findByTestId("v2-avisos-duplicacion")).toHaveTextContent(
      "Cotización nueva creada a partir de una anterior.",
    );
  });

  it("el diálogo de anular va al <body> y cubre la ventana", async () => {
    const user = userEvent.setup();
    await abrir(EMITIDA);
    await user.click(acciones().getByRole("button", { name: "Anular cotización" }));
    const dialogo = await screen.findByRole("dialog", { name: "Anular cotización" });
    expect(dialogo.parentElement).toBe(document.body);
  });

  it("la emitida enseña su documento congelado con total, emisión e historial", async () => {
    await abrir(EMITIDA, (url) =>
      url.includes("/confirmation-preview")
        ? jsonResponse(200, { ...resumenDeEmision(), status: "CONFIRMED", effective_status: "CONFIRMED", exchange_rate: "3.700000" })
        : url.includes("/history")
          ? jsonResponse(200, [
              { event: "CREATED", at: "2026-09-11T10:00:00Z", user_name: "Ana Emisora", details: {} },
              { event: "CONFIRMED", at: "2026-09-20T10:00:00Z", user_name: "Ana Emisora", details: {} },
            ])
          : undefined,
    );
    const documento = await screen.findByTestId("v2-documento-emitido");
    expect(within(documento).getByText("Documento emitido")).toBeInTheDocument();
    await waitFor(() => expect(documento).toHaveTextContent("Total: S/ 4177.20"));
    expect(documento).toHaveTextContent("TC 3.700");
    expect(documento).toHaveTextContent("por Ana Emisora");
    expect(within(documento).getByTestId("v2next-documento")).toBeInTheDocument();
    const historial = await within(documento).findByTestId("v2-historial");
    expect(within(historial).getAllByRole("listitem")).toHaveLength(2);
    expect(historial).not.toHaveTextContent(/CONFIRMED|CREATED/);
  });
});
