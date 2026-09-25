import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { errorResponse, jsonResponse, renderApp } from "@/test/utils";
import { COTIZACION, mockShell, resumenDeEmision } from "@/test/v2next/shellFixtures";

/**
 * El shell del Cotizador V2 rediseñado, montado con la aplicación entera (010O.3).
 *
 * Lo que se protege, además de que cada zona esté donde tiene que estar:
 *
 * 1. el paso viaja en la URL con los MISMOS nombres que `/cotizador-v2`;
 * 2. la barra de pasos juzga con `evaluarPasos` y los bloqueos del backend, no
 *    con la posición («hecho» ≠ «anterior al actual»);
 * 3. navegar NO espera a los guardados, y un guardado fallido se avisa sin
 *    encerrar a nadie;
 * 4. tras guardar, los pendientes se vuelven a pedir.
 */

const barra = () => within(screen.getByRole("navigation", { name: "Pasos" }));
const pasoActual = () => barra().getByRole("button", { current: "step" });
const tituloDelPaso = (nombre: string) => screen.findByRole("heading", { level: 2, name: nombre });

/** Elige una opción de un `SelectField` de los paneles. */

describe("shell del Cotizador V2 rediseñado: rutas", () => {
  it("abre el paso de la URL por su nombre, con la cabecera de la cotización", async () => {
    mockShell();
    renderApp(["/cotizador-v2-next/7/productos"]);

    expect(await tituloDelPaso("Piezas")).toBeInTheDocument();
    expect(screen.getByText("Paso 2 de 7")).toBeInTheDocument();
    expect(pasoActual()).toHaveAccessibleName(/Paso 2: Piezas/);
    expect(screen.getByRole("heading", { level: 1, name: "Pedido demo" })).toBeInTheDocument();
    expect(screen.getByText(COTIZACION.code)).toBeInTheDocument();
    expect(within(screen.getByTestId("v2next-cabecera")).getByRole("link", { name: /Cotizaciones/ })).toHaveAttribute(
      "href",
      "/cotizador-v2-next",
    );
    // El estado lo pinta el bloque del ciclo de vida, una sola vez.
    expect(screen.getAllByTestId("v2-estado-efectivo")).toHaveLength(1);
  });

  it("un paso numérico de antes lleva al paso por su nombre", async () => {
    mockShell();
    renderApp(["/cotizador-v2-next/7/3"]);
    expect(await tituloDelPaso("Arcilla y esmalte")).toBeInTheDocument();
  });

  it("sin paso lleva al primero que el backend bloquea", async () => {
    mockShell({ bloqueos: [{ code: "V2_CONFIRM_KILN_REQUIRED", line_id: null }] });
    renderApp(["/cotizador-v2-next/7"]);
    expect(await tituloDelPaso("Horno")).toBeInTheDocument();
    expect(pasoActual()).toHaveAccessibleName(/Horno/);
  });

  it("un paso que no existe cae en el primero pendiente; si no falta nada, en revisar", async () => {
    mockShell();
    renderApp(["/cotizador-v2-next/7/no-existe"]);
    expect(await tituloDelPaso("Revisar y emitir")).toBeInTheDocument();
  });

  it("una cotización emitida se abre en «Revisar y emitir», en solo lectura", async () => {
    mockShell({
      cotizacion: {
        status: "CONFIRMED",
        effective_status: "CONFIRMED",
        issued_at: "2026-09-20T10:00:00Z",
        valid_until: "2026-10-10",
      },
    });
    renderApp(["/cotizador-v2-next/7"]);
    expect(await tituloDelPaso("Revisar y emitir")).toBeInTheDocument();
    expect(screen.queryByTestId("v2next-estado-guardado")).not.toBeInTheDocument();
    expect(await screen.findByTestId("v2-documento-emitido")).toBeInTheDocument();
  });

  it("una cotización que no existe lo dice", async () => {
    mockShell({
      extra: (url) =>
        url.endsWith("/quotations-v2/7") ? errorResponse(404, "V2_QUOTATION_NOT_FOUND") : undefined,
    });
    renderApp(["/cotizador-v2-next/7/cliente"]);
    expect(await screen.findByText("Esa cotización V2 no existe. Comprueba el enlace.")).toBeInTheDocument();
  });
});

describe("shell del Cotizador V2 rediseñado: pasos y navegación", () => {
  it("la barra juzga cada paso con los bloqueos, no por su posición", async () => {
    mockShell({ bloqueos: [{ code: "V2_CONFIRM_LINE_BODY_MATERIAL_REQUIRED", line_id: 11 }] });
    renderApp(["/cotizador-v2-next/7/precio"]);
    await tituloDelPaso("Precio");

    await waitFor(() =>
      expect(barra().getByRole("button", { name: /Arcilla y esmalte/ })).toHaveAccessibleName(
        /Falta 1 dato/,
      ),
    );
    // Un paso posterior al actual puede estar listo; uno anterior, no estarlo.
    expect(barra().getByRole("button", { name: /Paso 1: Cliente/ })).toHaveTextContent("✓");
    expect(barra().getByRole("button", { name: /Revisar y emitir/ })).toHaveTextContent("!");
  });

  it("«Siguiente» y «anterior» mueven el paso y el foco va a su título", async () => {
    const user = userEvent.setup();
    mockShell();
    renderApp(["/cotizador-v2-next/7/cliente"]);
    await tituloDelPaso("Cliente");

    await user.click(screen.getByRole("button", { name: "Siguiente: Piezas" }));
    const piezas = await tituloDelPaso("Piezas");
    await waitFor(() => expect(piezas).toHaveFocus());

    // El botón de volver lleva el nombre del paso anterior; la flecha es decorativa.
    await user.click(screen.getByRole("button", { name: "Cliente" }));
    expect(await tituloDelPaso("Cliente")).toBeInTheDocument();
  });

  it("navegar NO espera a un guardado en curso", async () => {
    const user = userEvent.setup();
    mockShell({
      // El guardado de la cabecera no termina nunca.
      extra: (url, init) =>
        url.endsWith("/quotations-v2/7") && init.method === "PUT"
          ? new Promise<Response>(() => {})
          : undefined,
    });
    renderApp(["/cotizador-v2-next/7/cliente"]);
    await tituloDelPaso("Cliente");

    await user.click(await screen.findByRole("radio", { name: /alumno/i }));
    await waitFor(() =>
      expect(screen.getByTestId("v2next-estado-guardado")).toHaveTextContent("Guardando…"),
    );

    await user.click(screen.getByRole("button", { name: "Siguiente: Piezas" }));
    expect(await tituloDelPaso("Piezas")).toBeInTheDocument();
    expect(screen.getByTestId("v2next-estado-guardado")).toHaveTextContent("Guardando…");
  });

  it("un guardado fallido se avisa en todos los pasos, no encierra y se descarta", async () => {
    const user = userEvent.setup();
    mockShell({
      extra: (url, init) =>
        url.endsWith("/quotations-v2/7") && init.method === "PUT"
          ? errorResponse(422, "V2_VALIDATION_ERROR", "No válido")
          : undefined,
    });
    renderApp(["/cotizador-v2-next/7/cliente"]);
    await tituloDelPaso("Cliente");

    await user.click(await screen.findByRole("radio", { name: /alumno/i }));
    const aviso = await screen.findByTestId("v2next-guardados-fallidos");
    expect(aviso).toHaveTextContent("Un cambio no se guardó.");
    expect(screen.getByTestId("v2next-estado-guardado")).toHaveTextContent("Error al guardar");

    // Se puede ir a cualquier otro paso con el fallo pendiente.
    await user.click(barra().getByRole("button", { name: /Paso 6: Precio/ }));
    expect(await tituloDelPaso("Precio")).toBeInTheDocument();
    expect(screen.getByTestId("v2next-guardados-fallidos")).toBeInTheDocument();

    // «Ir a corregirlo» vuelve al paso del fallo.
    await user.click(within(screen.getByTestId("v2next-guardados-fallidos")).getByRole("button", { name: "Ir a corregirlo" }));
    expect(await tituloDelPaso("Cliente")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Descartar este cambio" }));
    await waitFor(() =>
      expect(screen.queryByTestId("v2next-guardados-fallidos")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("v2next-estado-guardado")).toHaveTextContent("Guardado");
  });
});

describe("shell del Cotizador V2 rediseñado: resumen y pendientes", () => {
  it("el resumen enseña las cifras del backend y los pendientes del resumen de emisión", async () => {
    mockShell({ bloqueos: [{ code: "V2_CONFIRM_KILN_REQUIRED", line_id: null }] });
    renderApp(["/cotizador-v2-next/7/cliente"]);
    await tituloDelPaso("Cliente");

    const resumen = screen.getByRole("complementary", { name: "Resumen de la cotización" });
    expect(await within(resumen).findByTestId("v2next-total")).toHaveTextContent("S/ 9077.74");
    const pendientes = await within(resumen).findByTestId("v2next-pendientes");
    await within(pendientes).findByText("Falta elegir el horno.");
  });

  it("tras un guardado los pendientes se vuelven a pedir y cambian", async () => {
    const user = userEvent.setup();
    let resumenes = 0;
    mockShell({
      extra: (url) => {
        if (!url.includes("/confirmation-preview")) return undefined;
        resumenes += 1;
        return jsonResponse(
          200,
          resumenDeEmision(
            resumenes === 1 ? [{ code: "V2_CONFIRM_KILN_REQUIRED", line_id: null }] : [],
          ),
        );
      },
    });
    renderApp(["/cotizador-v2-next/7/cliente"]);
    await tituloDelPaso("Cliente");
    const resumen = screen.getByRole("complementary", { name: "Resumen de la cotización" });
    await within(within(resumen).getByTestId("v2next-pendientes")).findByText("Falta elegir el horno.");

    await user.click(await screen.findByRole("radio", { name: /alumno/i }));

    await within(within(resumen).getByTestId("v2next-pendientes")).findByText("Todo listo para emitir");
    expect(resumenes).toBeGreaterThanOrEqual(2);
  });
});

describe("shell del Cotizador V2 rediseñado: estructura", () => {
  it("tres zonas con consulta de contenedor, sin pie fijo ni botón falso", async () => {
    mockShell();
    renderApp(["/cotizador-v2-next/7/cliente"]);
    await tituloDelPaso("Cliente");

    const asistente = screen.getByTestId("v2next-asistente");
    expect(asistente).toHaveClass("@container");
    expect(screen.getByTestId("v2next-rejilla")).toHaveClass(
      "grid-cols-1",
      "@min-[760px]:grid-cols-[200px_minmax(0,1fr)]",
      "@min-[1120px]:grid-cols-[216px_minmax(0,1fr)_290px]",
    );
    expect(screen.getByRole("complementary", { name: "Resumen de la cotización" })).toHaveClass(
      "@min-[760px]:col-span-full",
      "@min-[1120px]:col-span-1",
    );
    // Nada fijo a la ventana ni un segundo contenedor de scroll vertical.
    expect(asistente.querySelector(".fixed")).toBeNull();
    expect(asistente.querySelector(".overflow-y-auto, .overflow-auto")).toBeNull();
    expect(screen.queryByRole("button", { name: /guardar borrador/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/último guardado/i)).not.toBeInTheDocument();
  });
});
