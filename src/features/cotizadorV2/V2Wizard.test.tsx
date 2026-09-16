import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  V2_FIRING,
  V2_ILLUSTRATION,
  V2_LABOR_PAGE,
  V2_MATERIAL_PRODUCTS,
  V2_PRICING,
  V2_TECHNIQUES,
  V2_WORKERS,
} from "@/test/quoterV2Fixtures";
import { csrfResponse, jsonResponse, mockFetch, renderApp } from "@/test/utils";

/**
 * El flujo de siete pasos del Cotizador V2 (Fase 010G).
 *
 * Lo que estas pruebas protegen no es el maquetado, son las cuatro formas
 * conocidas de que un asistente estorbe:
 *
 * 1. **navegar reescribiendo.** Volver al paso uno para comprobar el cliente no
 *    puede guardar nada. Una cotización que cambia de precio por haberla
 *    mirado es inservible;
 * 2. **encerrar a quien lo usa.** Se salta a cualquier paso, incluso a uno
 *    incompleto. Obligar a rellenar en orden estricto es lo que hace que la
 *    gente abra una cotización nueva en vez de arreglar la que tiene;
 * 3. **confundir un aviso con un bloqueo.** Un esmalte sin existencia o una
 *    carga que supera el horno dejan seguir; una cotización sin cliente no;
 * 4. **decir el estado solo con color.** Quien no distingue el ámbar del verde
 *    vería siete casillas iguales, así que va también en palabras.
 */

const USER = {
  id: "11111111-2222-3333-4444-555555555555",
  email: "admin@empresa.com",
  display_name: "Administrador",
  role: "ADMIN" as const,
};

const COTIZACION = {
  id: 7,
  code: "CTZ-V2-2026-000001",
  pricing_engine_version: "V2",
  status: "DRAFT",
  effective_status: "DRAFT" as const,
  client_notes: null,
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
  production_type: "RETAIL",
  customer_id: 3,
  customer_name: "Cliente demo",
  name: "Pedido demo",
  notes: null,
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
  created_at: "2026-09-11T10:00:00Z",
  updated_at: "2026-09-11T10:00:00Z",
};

const LINEA = {
  id: 11,
  sort_order: 0,
  product_id: null,
  product_name: "Plato palta",
  quantity: 20,
  length_cm: "18.000000",
  width_cm: "12.000000",
  height_cm: "3.000000",
  unit_volume_cm3: "648.000000",
  total_volume_cm3: "12960.000000",
  firing_occupancy_percent: "76.235294",
  firing_volume_share_percent: "100.000000",
  firing_commercial_cost: "450.000000000000000000",
  firing_gas_cost: "105.000000000000000000",
  body_material_id: 3,
  body_material_name: "Arcilla Terranova",
  body_unit_weight: "500.000000",
  body_uom: "g",
  body_cost_per_unit: "0.001300000000",
  body_cost_is_override: false,
  body_total_weight: "10000.000000",
  body_cost: "13.000000000000000000",
  requires_glaze: false,
  glaze_material_id: null,
  glaze_material_name: null,
  glaze_is_reference: false,
  glaze_cost_per_unit: null,
  glaze_cost_is_override: false,
  glaze_percent: null,
  glaze_ml_per_gram: null,
  glaze_conversion_is_fallback: false,
  glaze_total_weight: "0.000000",
  glaze_volume_ml: "0.000000",
  glaze_cost: "0.000000000000000000",
  materials_cost: "13.000000000000000000",
  warnings: [] as string[],
};

const TERCEROS = {
  items: [
    { id: 3, name: "Cliente demo", role: "CLIENT", document_number: "20123456789", active: true },
    { id: 4, name: "Solo proveedor", role: "SUPPLIER", document_number: "20987654321", active: true },
  ],
  total: 2,
  limit: 20,
  offset: 0,
};

function mockV2(
  overrides: {
    cotizacion?: Record<string, unknown>;
    firing?: Record<string, unknown>;
    labor?: Record<string, unknown>;
  } = {},
) {
  const cotizacion = { ...COTIZACION, ...overrides.cotizacion };
  return mockFetch((url, init) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    // Correccion 010H: procesos de la pieza y adicionales.
    if (url.includes("/processes")) return jsonResponse(200, { items: [], warnings: [] });
    if (url.includes("/quoter-v2/products/")) {
      return jsonResponse(200, { product_id: 1, items: [] });
    }
    if (url.includes("/extras")) {
      return jsonResponse(200, { items: [], extras_cost_total: "0.000000", warnings: [] });
    }
    if (url.includes("/auth/me")) return jsonResponse(200, { authenticated: true, user: USER });
    if (url.includes("/quoter-v2/workers")) return jsonResponse(200, V2_WORKERS);
    if (url.includes("/quoter-v2/techniques")) return jsonResponse(200, V2_TECHNIQUES);
    if (url.includes("/quoter-v2/materials")) return jsonResponse(200, { items: [] });
    if (url.includes("/illustration")) return jsonResponse(200, V2_ILLUSTRATION);
    if (url.includes("/labor") || url.includes("/planning"))
      return jsonResponse(200, { ...V2_LABOR_PAGE, ...overrides.labor });
    if (url.includes("/pricing")) return jsonResponse(200, V2_PRICING);
    if (url.includes("/firing")) return jsonResponse(200, { ...V2_FIRING, ...overrides.firing });
    if (url.includes("/partners")) return jsonResponse(200, TERCEROS);
    if (url.includes("/quotations-v2/7/products"))
      return jsonResponse(200, { items: [LINEA], materials_cost: "13.000000000000000000" });
    if (url.includes("/products")) {
      const tipo = new URL(url, "http://x").searchParams.get("product_type");
      const items = V2_MATERIAL_PRODUCTS.filter((p) => p.product_type === tipo);
      return jsonResponse(200, { items, total: items.length, limit: 200, offset: 0 });
    }
    if (url.includes("/quotations-v2/7")) {
      if (init?.method === "PUT") return jsonResponse(200, cotizacion);
      return jsonResponse(200, cotizacion);
    }
    if (url.includes("/quotations-v2")) return jsonResponse(200, { items: [], total: 0 });
    return jsonResponse(200, {});
  });
}

/**
 * Lo que hace falta para que los siete pasos esten completos.
 *
 * La fixture compartida deja `effective_work_days` en nulo a proposito: sin
 * dias efectivos el espacio no entra en el costo, y eso lo decide una persona.
 * Las pruebas que hablan de una cotizacion terminada tienen que decidirlo.
 */
const TODO_LISTO = { labor: { effective_work_days: 2 } };

/** Los PUT que salieron hacia la cabecera de la cotización. */
function guardadosDeCabecera(spy: ReturnType<typeof mockFetch>) {
  return spy.mock.calls.filter(
    ([url, init]) =>
      String(url).endsWith("/quotations-v2/7") &&
      (init as RequestInit | undefined)?.method === "PUT",
  );
}

describe("Flujo de siete pasos del Cotizador V2 (Fase 010G)", () => {
  it("enseña los siete pasos en su orden", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7/cliente"]);

    const barra = await screen.findByTestId("pasos-cotizacion");
    const titulos = within(barra)
      .getAllByRole("button")
      .map((boton) => boton.textContent ?? "");
    expect(titulos).toHaveLength(7);
    expect(titulos[0]).toContain("Cliente");
    expect(titulos[6]).toContain("Resumen");
  });

  it("el estado de cada paso se dice con palabras, no solo con color", async () => {
    // Quien no distingue el ámbar del verde vería siete casillas iguales.
    mockV2({ cotizacion: { customer_id: null, customer_name: null } });

    renderApp(["/cotizador-v2/7/cliente"]);

    const barra = await screen.findByTestId("pasos-cotizacion");
    const cliente = within(barra).getByRole("button", { name: /1\. Cliente/ });
    expect(within(cliente).getByText("incompleto")).toBeInTheDocument();
  });

  it("abrir la ficha sin paso lleva al primero que falta", async () => {
    mockV2({ cotizacion: { customer_id: null, customer_name: null } });

    renderApp(["/cotizador-v2/7"]);

    expect(await screen.findByTestId("paso-cliente")).toBeInTheDocument();
  });

  it("un paso que no existe no es un error: cae en el que falta", async () => {
    // Cliente, productos y materiales están completos; la mano de obra no,
    // porque nadie ha decidido todavía los días efectivos de taller.
    mockV2();

    renderApp(["/cotizador-v2/7/loquesea"]);

    expect(await screen.findByTestId("panel-mano-de-obra")).toBeInTheDocument();
  });

  it("con todo listo, abrir sin paso lleva al resumen", async () => {
    mockV2(TODO_LISTO);

    renderApp(["/cotizador-v2/7"]);

    expect(await screen.findByTestId("paso-resumen")).toBeInTheDocument();
  });

  it("el botón de siguiente avanza al paso de al lado", async () => {
    mockV2();
    renderApp(["/cotizador-v2/7/cliente"]);
    const user = userEvent.setup();

    await screen.findByTestId("paso-cliente");
    // El de abajo, no el indicador de arriba: los dos dicen «Productos».
    await user.click(screen.getByRole("button", { name: "Productos →" }));

    expect(await screen.findByText(/productos y piezas/i)).toBeInTheDocument();
  });

  it("se puede saltar a un paso incompleto sin rellenar los anteriores", async () => {
    // Un asistente que obliga a ir en orden estricto es lo que hace que la
    // gente abra una cotización nueva en vez de arreglar la que tiene.
    mockV2({ cotizacion: { customer_id: null, customer_name: null } });
    renderApp(["/cotizador-v2/7/cliente"]);
    const user = userEvent.setup();

    const barra = await screen.findByTestId("pasos-cotizacion");
    await user.click(within(barra).getByRole("button", { name: /6\. Margen y precio/i }));

    expect(await screen.findByTestId("panel-precio")).toBeInTheDocument();
  });

  it("navegar NO guarda: mirar una cotización no la cambia", async () => {
    const spy = mockV2();
    renderApp(["/cotizador-v2/7/cliente"]);
    const user = userEvent.setup();

    const barra = await screen.findByTestId("pasos-cotizacion");
    await user.click(within(barra).getByRole("button", { name: /5\. Quema/i }));
    await screen.findByTestId("panel-quema");
    await user.click(within(barra).getByRole("button", { name: /1\. Cliente/i }));
    await screen.findByTestId("paso-cliente");

    expect(guardadosDeCabecera(spy)).toHaveLength(0);
  });

  it("completar un paso NO salta solo al siguiente", async () => {
    // Sin paso en la URL, el actual se derivaba en cada render: al elegir el
    // cliente, el paso uno pasaba a completo y la pantalla saltaba sola al dos
    // mientras la persona seguía mirando el uno. El sistema decidiendo, que es
    // justo lo que esta fase prohíbe.
    const spy = mockV2({ cotizacion: { customer_id: null, customer_name: null } });
    renderApp(["/cotizador-v2/7"]);
    const user = userEvent.setup();

    await screen.findByTestId("paso-cliente");
    await user.click(screen.getByRole("combobox", { name: "Cliente" }));
    await user.click(await screen.findByRole("option", { name: /Cliente demo/ }));

    await waitFor(() => expect(guardadosDeCabecera(spy).length).toBeGreaterThan(0));
    // Sigue en el paso uno: la cotización cambió, la pantalla no.
    expect(screen.getByTestId("paso-cliente")).toBeInTheDocument();
  });

  it("cambiar algo vuelve a pedir el precio: el backend recalcula en cascada", async () => {
    // Cada cambio dentro de la cotización mueve el motor económico entero.
    // Si la mutación solo invalidara su propia clave, el resumen enseñaría un
    // total viejo junto a unas líneas nuevas y las dos cifras no cuadrarían.
    const spy = mockV2();
    renderApp(["/cotizador-v2/7/cliente"]);
    const user = userEvent.setup();

    await screen.findByTestId("paso-cliente");
    const lecturasDePrecioAntes = spy.mock.calls.filter(([url]) =>
      String(url).includes("/pricing"),
    ).length;

    await user.click(screen.getByRole("combobox", { name: "Tipo de cliente" }));
    await user.click(await screen.findByRole("option", { name: "Alumno" }));

    await waitFor(() => {
      const ahora = spy.mock.calls.filter(([url]) => String(url).includes("/pricing")).length;
      expect(ahora).toBeGreaterThan(lecturasDePrecioAntes);
    });
  });

  it("dice «guardando» mientras hay una escritura en vuelo, y no antes de tiempo «guardado»", async () => {
    // Lo encontro la E2E de la revision: las escrituras de una cotizacion se
    // ponen en fila detras del bloqueo de su cabecera, y una recarga a mitad
    // perdia el cambio en silencio mientras la pantalla prometia que todo se
    // guarda solo. La promesa tiene que distinguir pendiente de hecho.
    let soltar: (() => void) | undefined;
    const base = mockV2({ cotizacion: { customer_id: null, customer_name: null } });
    const original = base.getMockImplementation();
    base.mockImplementation(async (entrada, init) => {
      const url = typeof entrada === "string" ? entrada : entrada.toString();
      if (url.endsWith("/quotations-v2/7") && init?.method === "PUT") {
        await new Promise<void>((resolver) => {
          soltar = resolver;
        });
      }
      return original!(entrada, init);
    });
    renderApp(["/cotizador-v2/7/cliente"]);
    const user = userEvent.setup();

    const estado = await screen.findByTestId("estado-guardado");
    expect(estado).toHaveTextContent(/todos los cambios guardados/i);

    await user.click(screen.getByRole("combobox", { name: "Tipo de cliente" }));
    await user.click(await screen.findByRole("option", { name: "Alumno" }));

    await waitFor(() => expect(estado).toHaveTextContent(/guardando/i));

    soltar?.();
    await waitFor(() => expect(estado).toHaveTextContent(/todos los cambios guardados/i));
  });

  it("un guardado RECHAZADO no aparenta guardado, sobrevive a cambiar de paso y protege la salida", async () => {
    // BLOCKER de la revision de Codex. Con un 500 el contador de peticiones
    // volvia a cero y el pie decia «Todos los cambios guardados»; el error vivia
    // solo en el panel, y al cambiar de paso desaparecia con el. Recargar
    // entonces perdia el cambio sin preguntar.
    const base = mockV2();
    const original = base.getMockImplementation();
    base.mockImplementation(async (entrada, init) => {
      const url = typeof entrada === "string" ? entrada : entrada.toString();
      if (url.endsWith("/quotations-v2/7") && init?.method === "PUT") {
        return jsonResponse(500, { error: { code: "INTERNAL", message: "Fallo del servidor" } });
      }
      return original!(entrada, init);
    });
    renderApp(["/cotizador-v2/7/cliente"]);
    const user = userEvent.setup();

    await screen.findByTestId("paso-cliente");
    await user.click(screen.getByRole("combobox", { name: "Tipo de cliente" }));
    await user.click(await screen.findByRole("option", { name: "Alumno" }));

    const aviso = await screen.findByTestId("guardados-fallidos");
    expect(aviso).toHaveTextContent(/NO se guard/i);
    expect(aviso).toHaveTextContent(/los datos de la cotizaci\u00f3n/i);
    expect(screen.getByTestId("estado-guardado")).toHaveTextContent(/no se guardaron/i);
    expect(screen.getByTestId("estado-guardado")).not.toHaveTextContent(/todos los cambios guardados/i);

    // Cambiar de paso desmonta el panel que lanzo la escritura: el aviso sigue.
    const barra = screen.getByTestId("pasos-cotizacion");
    await user.click(within(barra).getByRole("button", { name: /5\. Quema/i }));
    await screen.findByTestId("panel-quema");
    expect(screen.getByTestId("guardados-fallidos")).toBeInTheDocument();

    // Y recargar o cerrar pregunta antes.
    const salida = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(salida);
    expect(salida.defaultPrevented).toBe(true);
  });

  it("guardar despues el MISMO dato con exito resuelve el aviso; otro dato no", async () => {
    let fallar = true;
    const base = mockV2();
    const original = base.getMockImplementation();
    base.mockImplementation(async (entrada, init) => {
      const url = typeof entrada === "string" ? entrada : entrada.toString();
      if (url.endsWith("/quotations-v2/7") && init?.method === "PUT") {
        const cuerpo = JSON.parse(String(init.body));
        // Solo falla el tipo de cliente, y solo la primera vez.
        if (fallar && "customer_kind" in cuerpo) {
          fallar = false;
          return jsonResponse(500, { error: { code: "INTERNAL", message: "Fallo" } });
        }
      }
      return original!(entrada, init);
    });
    renderApp(["/cotizador-v2/7/cliente"]);
    const user = userEvent.setup();
    await screen.findByTestId("paso-cliente");

    await user.click(screen.getByRole("combobox", { name: "Tipo de cliente" }));
    await user.click(await screen.findByRole("option", { name: "Alumno" }));
    await screen.findByTestId("guardados-fallidos");

    // Guardar OTRO dato con exito no arregla el que fallo.
    await user.click(screen.getByRole("combobox", { name: "Moneda" }));
    await user.click(await screen.findByRole("option", { name: /d\u00f3lares/i }));
    await waitFor(() =>
      expect(screen.getByTestId("estado-guardado")).not.toHaveTextContent(/guardando/i),
    );
    expect(screen.getByTestId("guardados-fallidos")).toBeInTheDocument();

    // Volver a guardar el tipo de cliente, esta vez con exito, si.
    await user.click(screen.getByRole("combobox", { name: "Tipo de cliente" }));
    await user.click(await screen.findByRole("option", { name: "Alumno" }));
    await waitFor(() =>
      expect(screen.queryByTestId("guardados-fallidos")).not.toBeInTheDocument(),
    );
  });

  it("descartar un guardado rechazado devuelve el campo a lo guardado y no finge nada", async () => {
    // Re-revision de Codex: «Descartar este cambio» quitaba el aviso pero el
    // campo seguia ensenando el valor que el servidor rechazo.
    const base = mockV2();
    const original = base.getMockImplementation();
    base.mockImplementation(async (entrada, init) => {
      const url = typeof entrada === "string" ? entrada : entrada.toString();
      if (url.endsWith("/quotations-v2/7") && init?.method === "PUT") {
        return jsonResponse(422, { error: { code: "VALIDATION_ERROR", message: "No valido" } });
      }
      return original!(entrada, init);
    });
    renderApp(["/cotizador-v2/7/cliente"]);
    const user = userEvent.setup();
    await screen.findByTestId("paso-cliente");

    const campo = screen.getByLabelText(/nombre de la cotizaci\u00f3n/i);
    await user.clear(campo);
    await user.type(campo, "Rechazado");
    await user.tab();

    const aviso = await screen.findByTestId("guardados-fallidos");
    // Con el rechazo, el campo sigue ensenando lo que escribio el usuario.
    expect(campo).toHaveValue("Rechazado");

    await user.click(within(aviso).getByRole("button", { name: "Descartar este cambio" }));

    await waitFor(() => expect(screen.queryByTestId("guardados-fallidos")).not.toBeInTheDocument());
    await waitFor(() => expect(campo).toHaveValue("Pedido demo"));
    expect(screen.getByTestId("estado-guardado")).toHaveTextContent(/todos los cambios guardados/i);
  });

  it("lo tecleado SIN salir del campo tambien protege la salida", async () => {
    // BLOCKER de la revision de Codex. Los campos guardan al salir; mientras se
    // escribe no hay peticion en vuelo, y la proteccion no veia nada: teclear y
    // recargar sin blur perdia el cambio en silencio.
    mockV2();
    renderApp(["/cotizador-v2/7/cliente"]);
    const user = userEvent.setup();
    await screen.findByTestId("paso-cliente");

    const sinCambios = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(sinCambios);
    expect(sinCambios.defaultPrevented).toBe(false);

    await user.type(screen.getByLabelText(/nombre de la cotizaci\u00f3n/i), " de feria");

    expect(screen.getByTestId("estado-guardado")).toHaveTextContent(/cambios sin guardar/i);
    const conCambios = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(conCambios);
    expect(conCambios.defaultPrevented).toBe(true);
  });

  it("volver a escribir en el nombre mientras llega el refetch no borra lo nuevo", async () => {
    // Hallazgo de Codex sobre el paso de cliente: escribir, salir (se guarda),
    // volver a entrar y seguir escribiendo; al llegar el refetch, lo guardado
    // cambia y el efecto pisaba lo que se estaba tecleando.
    let soltar: (() => void) | undefined;
    let nombreGuardado = "Pedido demo";
    const base = mockV2();
    const original = base.getMockImplementation();
    base.mockImplementation(async (entrada, init) => {
      const url = typeof entrada === "string" ? entrada : entrada.toString();
      if (url.endsWith("/quotations-v2/7") && init?.method === "PUT") {
        const cuerpo = JSON.parse(String(init.body));
        await new Promise<void>((resolver) => {
          soltar = resolver;
        });
        if ("name" in cuerpo) nombreGuardado = cuerpo.name;
      }
      if (url.endsWith("/quotations-v2/7")) {
        const respuesta = await original!(entrada, init);
        const datos = await respuesta.json();
        return jsonResponse(200, { ...datos, name: nombreGuardado });
      }
      return original!(entrada, init);
    });
    renderApp(["/cotizador-v2/7/cliente"]);
    const user = userEvent.setup();
    await screen.findByTestId("paso-cliente");

    const campo = screen.getByLabelText(/nombre de la cotizaci\u00f3n/i);
    await user.clear(campo);
    await user.type(campo, "Feria");
    await user.tab();
    await waitFor(() => expect(soltar).toBeDefined());

    // Se vuelve a entrar y se sigue escribiendo ANTES de que el guardado vuelva.
    await user.click(campo);
    await user.type(campo, " de octubre");
    soltar?.();

    await waitFor(() =>
      expect(screen.getByTestId("estado-guardado")).not.toHaveTextContent(/guardando/i),
    );
    expect(campo).toHaveValue("Feria de octubre");
  });

  it("un error del paso se explica arriba y se marca como falta", async () => {
    mockV2({ cotizacion: { customer_id: null, customer_name: null } });

    renderApp(["/cotizador-v2/7/cliente"]);

    const senales = await screen.findByTestId("senales-del-paso");
    expect(within(senales).getByText(/falta el cliente/i)).toBeInTheDocument();
  });

  it("un aviso no impide seguir y se distingue de un error", async () => {
    // Superar la capacidad del horno avisa: la solución la elige una persona.
    mockV2({ firing: { warnings: ["V2_FIRING_OVER_CAPACITY"] } });

    renderApp(["/cotizador-v2/7/quema"]);

    // Se espera al texto, no al contenedor: el contenedor aparece en cuanto el
    // paso se pinta y los datos llegan después.
    expect(await screen.findByText(/supera el horno/i)).toBeInTheDocument();
    const senales = screen.getByTestId("senales-del-paso");
    expect(within(senales).getByText(/supera el horno/i)).toBeInTheDocument();
    const barra = screen.getByTestId("pasos-cotizacion");
    const quema = within(barra).getByRole("button", { name: /5\. Quema/ });
    expect(within(quema).getByText("con avisos")).toBeInTheDocument();
    expect(within(quema).queryByText("incompleto")).not.toBeInTheDocument();
  });

  it("una recomendación se llama recomendación", async () => {
    // «Cabe en un horno más chico» es una frase, no una orden.
    mockV2({ firing: { warnings: ["V2_FIRING_SMALLER_KILN_FITS"] } });

    renderApp(["/cotizador-v2/7/quema"]);

    // El aviso aparece dos veces: en el panel de quema, que lista los codigos
    // del backend, y en la barra de señales del paso, que ademas les pone
    // severidad. Lo que se comprueba aqui es lo segundo.
    const senales = await screen.findByTestId("senales-del-paso");
    expect(await within(senales).findByText(/Recomendación:/)).toBeInTheDocument();
    expect(within(senales).getByText(/horno más chico/i)).toBeInTheDocument();
  });
});

describe("El resumen (paso 7)", () => {
  it("dice qué falta y lleva a arreglarlo", async () => {
    mockV2({ cotizacion: { customer_id: null, customer_name: null } });
    renderApp(["/cotizador-v2/7/resumen"]);
    const user = userEvent.setup();

    const pendientes = await screen.findByTestId("resumen-pendientes");
    expect(within(pendientes).getByText(/falta el cliente/i)).toBeInTheDocument();

    await user.click(within(pendientes).getByRole("button", { name: "Cliente" }));

    expect(await screen.findByTestId("paso-cliente")).toBeInTheDocument();
  });

  it("con todo completo dice que puede emitirse", async () => {
    mockV2(TODO_LISTO);

    renderApp(["/cotizador-v2/7/resumen"]);

    expect(await screen.findByTestId("resumen-listo")).toBeInTheDocument();
  });

  it("los importes se enseñan como dinero, no con dieciocho decimales", async () => {
    // El backend devuelve `9077.740000000000000000` porque la columna es
    // NUMERIC(36,18). Eso es precisión de cálculo, no una cifra que alguien
    // pueda leer en una pantalla.
    mockV2(TODO_LISTO);

    renderApp(["/cotizador-v2/7/resumen"]);

    expect(await screen.findByText("S/ 9077.74")).toBeInTheDocument();
    const precio = screen.getByTestId("resumen-precio");
    expect(within(precio).getByText("S/ 9077.74")).toBeInTheDocument();
    expect(within(precio).queryByText(/9077\.740000000000000000/)).not.toBeInTheDocument();
  });

  it("no rehace ninguna cuenta: los totales son los del backend", async () => {
    mockV2(TODO_LISTO);

    renderApp(["/cotizador-v2/7/resumen"]);

    // Subtotal 7693 + IGV 1384.74 = 9077.74. La pantalla los pinta, no los suma.
    expect(await screen.findByText("S/ 7693.00")).toBeInTheDocument();
    const precio = screen.getByTestId("resumen-precio");
    expect(within(precio).getByText("S/ 7693.00")).toBeInTheDocument();
    expect(within(precio).getByText("S/ 9077.74")).toBeInTheDocument();
  });
});

describe("El paso del cliente (paso 1)", () => {
  it("elegir un cliente lo manda a la cabecera", async () => {
    const spy = mockV2({ cotizacion: { customer_id: null, customer_name: null } });
    renderApp(["/cotizador-v2/7/cliente"]);
    const user = userEvent.setup();

    await screen.findByTestId("paso-cliente");
    await user.click(screen.getByRole("combobox", { name: "Cliente" }));
    await user.click(await screen.findByRole("option", { name: /Cliente demo/ }));

    await waitFor(() => {
      const guardado = guardadosDeCabecera(spy).at(-1);
      expect(guardado).toBeDefined();
      expect(JSON.parse(String((guardado?.[1] as RequestInit).body))).toEqual({ customer_id: 3 });
    });
  });

  it("un proveedor puro no se ofrece como cliente", async () => {
    // El backend lo rechaza: enseñarlo solo sirve para provocar un error.
    mockV2();
    renderApp(["/cotizador-v2/7/cliente"]);
    const user = userEvent.setup();

    await screen.findByTestId("paso-cliente");
    await user.click(screen.getByRole("combobox", { name: "Cliente" }));

    expect(await screen.findByRole("option", { name: /Cliente demo/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Solo proveedor/ })).not.toBeInTheDocument();
  });

  it("en soles no pregunta por el tipo de cambio", async () => {
    mockV2();

    renderApp(["/cotizador-v2/7/cliente"]);

    await screen.findByTestId("paso-cliente");
    expect(screen.queryByLabelText(/tipo de cambio/i)).not.toBeInTheDocument();
  });

  it("en dólares lo pide, porque sin él no hay conversión", async () => {
    mockV2({ cotizacion: { currency_code: "USD", currency_symbol: "US$", exchange_rate: "3.75" } });

    renderApp(["/cotizador-v2/7/cliente"]);

    await screen.findByTestId("paso-cliente");
    expect(screen.getByLabelText(/tipo de cambio/i)).toHaveValue("3.75");
  });

  it("el nombre no se guarda mientras se teclea", async () => {
    const spy = mockV2();
    renderApp(["/cotizador-v2/7/cliente"]);
    const user = userEvent.setup();

    await screen.findByTestId("paso-cliente");
    const campo = screen.getByLabelText(/nombre de la cotización/i);
    await user.clear(campo);
    await user.type(campo, "Feria de octubre");

    expect(guardadosDeCabecera(spy)).toHaveLength(0);

    await user.tab();

    await waitFor(() => {
      const guardado = guardadosDeCabecera(spy).at(-1);
      expect(JSON.parse(String((guardado?.[1] as RequestInit).body))).toEqual({
        name: "Feria de octubre",
      });
    });
  });

  it("acepta la coma decimal en el tipo de cambio", async () => {
    const spy = mockV2({
      cotizacion: { currency_code: "USD", currency_symbol: "US$", exchange_rate: "3.75" },
    });
    renderApp(["/cotizador-v2/7/cliente"]);
    const user = userEvent.setup();

    await screen.findByTestId("paso-cliente");
    const campo = screen.getByLabelText(/tipo de cambio/i);
    await user.clear(campo);
    await user.type(campo, "3,80");
    await user.tab();

    await waitFor(() => {
      const guardado = guardadosDeCabecera(spy).at(-1);
      // Sale con punto: la coma es de quien escribe, no del protocolo.
      expect(JSON.parse(String((guardado?.[1] as RequestInit).body))).toEqual({
        exchange_rate: "3.80",
      });
    });
  });
});
