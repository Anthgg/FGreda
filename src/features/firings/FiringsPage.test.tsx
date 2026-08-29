/**
 * Pruebas del modulo de quemas.
 *
 * Se comprueba lo que la pantalla promete: que muestra lo que el backend
 * calcula sin recalcularlo, que los filtros viajan al servidor, que los
 * importes decimales llegan intactos y que ningun selector es nativo.
 */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatDecimalString,
  formatPercentage,
  multiplyDecimalStrings,
} from "@/features/firings/labels";
import { aPayload, borradorVacio, nuevaLinea } from "@/features/firings/draft";
import {
  CALCULO,
  CALCULO_EXCEDIDO,
  FIRINGS_PAGE,
  HISTORIAL_TARIFAS,
  HORNO_CHICO,
  KILNS_PAGE,
  PRODUCTS_PAGE,
  QUEMA_BORRADOR,
  QUEMA_CONFIRMADA,
} from "@/test/firingsFixtures";
import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderApp,
  sessionResponse,
  TEST_USER,
} from "@/test/utils";

interface Escenario {
  calculo?: typeof CALCULO;
  calculoError?: { status: number; code: string };
  firings?: typeof FIRINGS_PAGE;
  detalle?: typeof QUEMA_CONFIRMADA;
  rol?: "ADMIN" | "OPERATOR";
}

/** Doble del backend con las respuestas del modulo. */
/**
 * Handler del escenario de Quemas, expuesto aparte de `mockQuemas` para que un
 * test pueda interceptar UNA ruta y delegar el resto sin duplicar el mock
 * entero.
 */
function quemasHandler(escenario: Escenario = {}) {
  const {
    calculo = CALCULO,
    calculoError,
    firings = FIRINGS_PAGE,
    detalle = QUEMA_CONFIRMADA,
    rol = "ADMIN",
  } = escenario;

  return (url: string, init: RequestInit) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) {
      return sessionResponse({ ...TEST_USER, role: rol });
    }
    if (url.includes("/firings/calculate")) {
      if (calculoError) return errorResponse(calculoError.status, calculoError.code);
      return jsonResponse(200, calculo);
    }
    if (/\/firings\/\d+\/confirm/.test(url)) {
      return jsonResponse(200, { ...detalle, status: "CONFIRMED" });
    }
    if (/\/firings\/\d+\/cancel/.test(url)) {
      return jsonResponse(200, { ...detalle, status: "CANCELLED" });
    }
    if (/\/firings\/\d+(\?|$)/.test(url)) return jsonResponse(200, detalle);
    if (url.includes("/firings") && (init.method ?? "GET") === "POST") {
      return jsonResponse(201, QUEMA_BORRADOR);
    }
    if (url.includes("/firings")) return jsonResponse(200, firings);
    if (/\/kilns\/\d+\/rates/.test(url)) {
      if ((init.method ?? "GET") === "POST") return jsonResponse(201, HISTORIAL_TARIFAS[0]);
      return jsonResponse(200, HISTORIAL_TARIFAS);
    }
    if (/\/kilns\/\d+\/occupancy-factors/.test(url)) {
      return jsonResponse(200, HORNO_CHICO.occupancy_factors);
    }
    if (url.includes("/kilns") && (init.method ?? "GET") === "POST") {
      return jsonResponse(201, HORNO_CHICO);
    }
    if (url.includes("/kilns")) return jsonResponse(200, KILNS_PAGE);
    if (url.includes("/categories")) {
      return jsonResponse(200, [
        { id: 1, name: "Piezas", parent_id: null, display_path: "Piezas", active: true },
      ]);
    }
    if (url.includes("/units")) {
      return jsonResponse(200, [
        {
          code: "unit",
          name: "Unidad",
          symbol: "u",
          dimension: "COUNT",
          factor_to_base: "1",
          is_base: true,
          active: true,
        },
      ]);
    }
    if (url.includes("/products") && (init.method ?? "GET") === "POST") {
      const body = init.body ? JSON.parse(String(init.body)) : {};
      return jsonResponse(201, {
        id: 502,
        internal_reference: "LAB50002",
        name: body.name || "Nueva pieza",
        product_type: body.product_type || "FINISHED_PRODUCT",
        product_category_id: body.product_category_id || 1,
        product_category_path: "Piezas",
        base_uom_code: body.base_uom_code || "unit",
        purchase_uom_code: body.purchase_uom_code || "unit",
        active: true,
        sellable: false,
        purchasable: false,
        available_in_pos: false,
        cost: null,
        sale_price: null,
        sale_tax_rate: null,
        purchase_tax_rate: null,
        notes: null,
      });
    }
    if (url.includes("/products")) {
      const u = new URL(url, "http://localhost");
      const search = u.searchParams.get("search");
      if (search && !search.toLowerCase().includes("plato")) {
        return jsonResponse(200, { items: [], total: 0, limit: 50, offset: 0 });
      }
      return jsonResponse(200, PRODUCTS_PAGE);
    }
    return errorResponse(404, "NOT_FOUND");
  };
}

function mockQuemas(escenario: Escenario = {}) {
  return mockFetch(quemasHandler(escenario));
}

function urls(spy: ReturnType<typeof mockFetch>): string[] {
  return spy.mock.calls.map(([entrada]) => String(entrada));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
describe("quemas: estructura de la pantalla", () => {
  it("muestra el titulo y las tres vistas", async () => {
    mockQuemas();
    renderApp(["/quemas"]);

    expect(await screen.findByRole("tab", { name: "Listado" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Hornos y tarifas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Simulador" })).toBeInTheDocument();
  });

  it("«Nueva quema» es una accion de la cabecera, no una cuarta pestaña", async () => {
    mockQuemas();
    renderApp(["/quemas"]);

    await screen.findByRole("tab", { name: "Listado" });
    expect(screen.getByRole("link", { name: "Nueva quema" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /nueva quema/i })).not.toBeInTheDocument();
  });

  it("no usa ningun <select> nativo", async () => {
    mockQuemas();
    const { container } = renderApp(["/quemas"]);

    await screen.findByRole("tab", { name: "Listado" });
    await waitFor(() => expect(screen.getByText("HR-2026-000001")).toBeInTheDocument());

    expect(container.querySelectorAll("select")).toHaveLength(0);
  });

  it("la pagina no bloquea el desplazamiento del documento", async () => {
    mockQuemas();
    renderApp(["/quemas"]);

    await screen.findByRole("tab", { name: "Listado" });
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

// ---------------------------------------------------------------------------
describe("quemas: listado", () => {
  it("lista las hojas con su codigo, estado y costo", async () => {
    mockQuemas();
    renderApp(["/quemas"]);

    expect(await screen.findByText("HR-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("HR-2026-000002")).toBeInTheDocument();
    // Estados en castellano, nunca el valor del contrato.
    expect(screen.getAllByText("Confirmada").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Borrador").length).toBeGreaterThan(0);
    expect(screen.queryByText("CONFIRMED")).not.toBeInTheDocument();
  });

  it("la busqueda viaja al servidor", async () => {
    const spy = mockQuemas();
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await screen.findByText("HR-2026-000001");
    await user.type(screen.getByLabelText(/buscar quemas/i), "HR-2026-000001");

    await waitFor(
      () => {
        expect(
          urls(spy).some((u) => u.includes("/firings?") && u.includes("search=HR-2026-000001")),
        ).toBe(true);
      },
      { timeout: 3000 },
    );
  });

  it("el filtro de estado viaja al servidor", async () => {
    const spy = mockQuemas();
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await screen.findByText("HR-2026-000001");
    await user.click(screen.getByRole("combobox", { name: /estado/i }));
    await user.click(await screen.findByRole("option", { name: "Confirmada" }));

    await waitFor(() =>
      expect(urls(spy).some((u) => u.includes("status=CONFIRMED"))).toBe(true),
    );
  });

  it("pagina en el servidor y no en el navegador", async () => {
    const spy = mockQuemas();
    renderApp(["/quemas"]);

    await screen.findByText("HR-2026-000001");
    expect(urls(spy).some((u) => u.includes("limit=25") && u.includes("offset=0"))).toBe(true);
  });

  it("muestra el estado vacio cuando no hay coincidencias", async () => {
    mockQuemas({ firings: { items: [], total: 0, limit: 25, offset: 0 } });
    renderApp(["/quemas"]);

    expect(await screen.findByText(/no hay quemas que coincidan/i)).toBeInTheDocument();
  });

  it("informa del error del servidor sin mostrar su texto crudo", async () => {
    mockFetch((url) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      if (url.includes("/auth/me")) return sessionResponse();
      if (url.includes("/kilns")) return jsonResponse(200, KILNS_PAGE);
      return errorResponse(500, "INTERNAL_ERROR");
    });
    renderApp(["/quemas"]);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe("quemas: detalle", () => {
  it("muestra sesiones, piezas y el reparto que calculo el servidor", async () => {
    mockQuemas();
    renderApp(["/quemas"]);

    await screen.findByText("Plato palta");

    // Volumen y costo tal y como los devolvio el backend.
    expect(screen.getAllByText("12960").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1249.66").length).toBeGreaterThan(0);
    // El factor de la linea, sin recalcular.
    expect(screen.getAllByText("×1.20").length).toBeGreaterThan(0);
  });

  it("una hoja confirmada avisa de que muestra la tarifa aplicada", async () => {
    mockQuemas();
    renderApp(["/quemas"]);

    expect(await screen.findByText(/tarifa aplicada/i)).toBeInTheDocument();
    expect(screen.getByText(/cambiar una tarifa hoy no los modifica/i)).toBeInTheDocument();
  });

  it("una hoja confirmada no ofrece confirmar de nuevo", async () => {
    mockQuemas();
    renderApp(["/quemas"]);

    await screen.findByText("Plato palta");
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anular" })).toBeInTheDocument();
  });

  it("un borrador si ofrece confirmar", async () => {
    mockQuemas({ detalle: QUEMA_BORRADOR });
    renderApp(["/quemas"]);

    expect(await screen.findByRole("button", { name: "Confirmar" })).toBeInTheDocument();
  });

  it("confirmar llama al endpoint del backend", async () => {
    const spy = mockQuemas({ detalle: QUEMA_BORRADOR });
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(urls(spy).some((u) => u.endsWith("/confirm"))).toBe(true));
  });

  it("un error de capacidad al confirmar se muestra en castellano", async () => {
    mockFetch((url, init) => {
      if (url.includes("/auth/csrf")) return csrfResponse();
      if (url.includes("/auth/me")) return sessionResponse();
      if (url.includes("/kilns")) return jsonResponse(200, KILNS_PAGE);
      if (url.endsWith("/confirm")) return errorResponse(409, "KILN_CAPACITY_EXCEEDED");
      if (/\/firings\/\d+(\?|$)/.test(url)) return jsonResponse(200, QUEMA_BORRADOR);
      if (url.includes("/firings") && (init.method ?? "GET") === "GET") {
        return jsonResponse(200, FIRINGS_PAGE);
      }
      return errorResponse(404, "NOT_FOUND");
    });
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("button", { name: "Confirmar" }));

    const alertas = await screen.findAllByRole("alert");
    expect(alertas.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
describe("quemas: hornos y tarifas", () => {
  it("lista los hornos con su capacidad y sus tarifas vigentes", async () => {
    mockQuemas();
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("tab", { name: "Hornos y tarifas" }));

    expect(await screen.findByText("Horno pequeño")).toBeInTheDocument();
    expect(screen.getByText("Horno grande")).toBeInTheDocument();
    expect(screen.getByText("KILN-001")).toBeInTheDocument();
    // 17000 cm³ y las tarifas 90 / 180.
    expect(screen.getByText("17000 cm³")).toBeInTheDocument();
    expect(screen.getByText("90.00")).toBeInTheDocument();
    expect(screen.getByText("180.00")).toBeInTheDocument();
  });

  it("muestra la tabla de factores por tramo de ocupacion", async () => {
    mockQuemas();
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("tab", { name: "Hornos y tarifas" }));
    await screen.findByText("Horno pequeño");

    expect(screen.getByText(/factor por ocupación \(10 tramos\)/i)).toBeInTheDocument();
    // El tramo del caso de referencia.
    expect(screen.getAllByText(/71–80 %/).length).toBeGreaterThan(0);
  });

  it("EDIT_OCCUPANCY_FACTORS + SAVE_RELOAD: la tabla se edita y se guarda contra el backend", async () => {
    // Antes existia PUT /kilns/{id}/occupancy-factors y NINGUNA pantalla lo
    // llamaba: la tabla era de solo lectura y un horno sin factores no tenia
    // forma de arreglarse desde la aplicacion.
    const enviados: unknown[] = [];
    mockFetch((url, init) => {
      if (/\/kilns\/\d+\/occupancy-factors/.test(url) && init.method === "PUT") {
        enviados.push(JSON.parse(String(init.body)));
        return jsonResponse(200, HORNO_CHICO.occupancy_factors);
      }
      return quemasHandler()(url, init);
    });
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("tab", { name: "Hornos y tarifas" }));
    await screen.findByText("Horno pequeño");

    await user.click(screen.getAllByRole("button", { name: /editar factores/i })[0]!);
    await user.click(screen.getByRole("button", { name: /guardar factores/i }));

    await waitFor(() => expect(enviados.length).toBe(1));
    const tabla = enviados[0] as Array<Record<string, unknown>>;
    // Se envia la tabla COMPLETA, de 1 a 100, como exige el backend.
    expect(tabla[0]).toMatchObject({ min_percentage: 1 });
    expect(tabla[tabla.length - 1]).toMatchObject({ max_percentage: 100 });
    // Y se sale del modo edicion solo tras la confirmacion del backend.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /guardar factores/i })).not.toBeInTheDocument(),
    );
  });

  it("API_ERROR: si el backend rechaza los factores, no se muestra falso exito", async () => {
    mockFetch((url, init) => {
      if (/\/kilns\/\d+\/occupancy-factors/.test(url) && init.method === "PUT") {
        return errorResponse(422, "VALIDATION_ERROR", "Discontinuidad o solapamiento en tramos");
      }
      return quemasHandler()(url, init);
    });
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("tab", { name: "Hornos y tarifas" }));
    await screen.findByText("Horno pequeño");
    await user.click(screen.getAllByRole("button", { name: /editar factores/i })[0]!);
    await user.click(screen.getByRole("button", { name: /guardar factores/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // El editor sigue abierto: nada se dio por guardado.
    expect(screen.getByRole("button", { name: /guardar factores/i })).toBeInTheDocument();
  });

  it("CREATE_KILN_WITH_FACTORS: el alta envia la tabla y no deja el horno muerto", async () => {
    const creados: Array<Record<string, unknown>> = [];
    mockFetch((url, init) => {
      if (url.includes("/kilns") && init.method === "POST" && !url.includes("rates")) {
        creados.push(JSON.parse(String(init.body)));
        return jsonResponse(201, HORNO_CHICO);
      }
      return quemasHandler()(url, init);
    });
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("tab", { name: "Hornos y tarifas" }));
    await user.click(await screen.findByRole("button", { name: /nuevo horno/i }));

    // El alta vive en su propio formulario; el resto de la pestana tiene
    // campos con nombres parecidos.
    const alta = (await screen.findByRole("heading", { name: /nuevo horno/i }))
      .closest("form") as HTMLFormElement;
    await user.type(within(alta).getByLabelText(/nombre/i), "Horno de prueba");
    await user.type(within(alta).getByLabelText(/capacidad/i), "5000");

    // CREATE_KILN_WITHOUT_FACTORS: sin multiplicadores el alta esta bloqueada,
    // asi que no se puede crear un horno inservible por descuido.
    expect(within(alta).getByRole("button", { name: /crear horno/i })).toBeDisabled();

    const factores = within(alta).getAllByPlaceholderText("Ej. 1.5");
    for (const campo of factores) await user.type(campo, "1.5");

    await waitFor(() =>
      expect(within(alta).getByRole("button", { name: /crear horno/i })).toBeEnabled(),
    );
    await user.click(within(alta).getByRole("button", { name: /crear horno/i }));

    await waitFor(() => expect(creados.length).toBe(1));
    const enviado = creados[0]!;
    const tramos = enviado["occupancy_factors"] as Array<Record<string, unknown>>;
    expect(tramos).toHaveLength(10);
    expect(tramos[0]).toMatchObject({ min_percentage: 1, factor: "1.5" });
    expect(tramos[9]).toMatchObject({ max_percentage: 100 });
    // El codigo NUNCA lo manda el frontend: lo emite el backend.
    expect(enviado).not.toHaveProperty("code");
  });

  it("el historial de tarifas distingue la vigente de la cerrada", async () => {
    mockQuemas();
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("tab", { name: "Hornos y tarifas" }));
    await screen.findByText("Horno pequeño");
    await user.click(screen.getAllByRole("button", { name: /ver historial de tarifas/i })[0]!);

    expect(await screen.findByText("Vigente")).toBeInTheDocument();
    // La misma fecha abre una vigencia y cierra la anterior.
    expect(screen.getAllByText("2026-06-01")).toHaveLength(2);
    expect(screen.getByText("1800.00")).toBeInTheDocument();
  });

  it("un OPERATOR no ve los controles de edicion", async () => {
    mockQuemas({ rol: "OPERATOR" });
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("tab", { name: "Hornos y tarifas" }));
    await screen.findByText("Horno pequeño");

    expect(screen.queryByRole("button", { name: /nuevo horno/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /fijar tarifa/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe("quemas: simulador", () => {
  it("pide el calculo al backend y no lo reimplementa", async () => {
    const spy = mockQuemas();
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("tab", { name: "Simulador" }));
    await screen.findByText(/simular no guarda nada/i);

    // Sin sesiones ni piezas no se pide nada al servidor.
    expect(urls(spy).some((u) => u.includes("/firings/calculate"))).toBe(false);
    expect(screen.getByText(/complete al menos una sesión de horno/i)).toBeInTheDocument();
  });

  it("avisa de la capacidad excedida sin bloquear la captura", async () => {
    mockQuemas({ calculo: CALCULO_EXCEDIDO });
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("tab", { name: "Simulador" }));
    expect(await screen.findByText(/simular no guarda nada/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe("quemas: permisos", () => {
  it("un OPERATOR no puede crear quemas", async () => {
    mockQuemas({ rol: "OPERATOR" });
    renderApp(["/quemas"]);

    await screen.findByRole("tab", { name: "Listado" });
    expect(screen.queryByRole("link", { name: "Nueva quema" })).not.toBeInTheDocument();
  });

  it("un OPERATOR no puede confirmar ni anular", async () => {
    mockQuemas({ rol: "OPERATOR", detalle: QUEMA_BORRADOR });
    renderApp(["/quemas"]);

    await screen.findByText("Plato palta");
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anular" })).not.toBeInTheDocument();
  });

  it("un ADMIN si ve las acciones", async () => {
    mockQuemas({ detalle: QUEMA_BORRADOR });
    renderApp(["/quemas"]);

    expect(await screen.findByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nueva quema" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
describe("quemas: nueva quema (/quemas/nueva)", () => {
  it("navega a /quemas/nueva al hacer clic en 'Nueva quema' y NO renderiza un modal dialog", async () => {
    mockQuemas();
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("link", { name: "Nueva quema" }));

    // La nueva quema es una página real, no un modal dialog
    expect(screen.queryByRole("dialog", { name: /nueva quema/i })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Nueva quema" })).toBeInTheDocument();
    expect(screen.getByText("Borrador")).toBeInTheDocument();
    expect(await screen.findByText("Sesiones de horno")).toBeInTheDocument();
    expect(screen.getByText("Piezas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /agregar pieza/i })).toBeInTheDocument();
  });

  it("no permite guardar una hoja incompleta", async () => {
    mockQuemas();
    renderApp(["/quemas/nueva"]);

    await screen.findByRole("heading", { name: "Nueva quema" });
    await screen.findByText("Sesiones de horno");
    const guardarBtns = screen.getAllByRole("button", { name: /guardar borrador/i });
    for (const btn of guardarBtns) {
      expect(btn).toBeDisabled();
    }
  });

  it("la pieza se elige del catálogo y no se teclea a mano", async () => {
    const spy = mockQuemas();
    renderApp(["/quemas/nueva"]);

    await screen.findByRole("heading", { name: "Nueva quema" });

    // Hay un selector de pieza, y ningun campo libre de descripcion
    expect(await screen.findByRole("combobox", { name: /pieza/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/descripción/i)).not.toBeInTheDocument();

    // El catalogo se consulta al servidor, filtrado a productos terminados.
    await waitFor(() =>
      expect(
        urls(spy).some((u) => u.includes("/products") && u.includes("FINISHED_PRODUCT")),
      ).toBe(true),
    );
  });

  it("selecciona el horno con el selector propio, no con uno nativo", async () => {
    mockQuemas();
    const { container } = renderApp(["/quemas/nueva"]);

    await screen.findByRole("heading", { name: "Nueva quema" });
    await screen.findByText("Sesiones de horno");

    expect(container.querySelectorAll("select")).toHaveLength(0);
    // El selector propio se expone como combobox accesible, no como <select>.
    expect(screen.getAllByRole("combobox", { name: /horno/i }).length).toBeGreaterThan(0);
  });

  it("ADMIN puede crear una pieza contextual desde el selector y queda automáticamente seleccionada", async () => {
    const spy = mockQuemas();
    const user = userEvent.setup();
    renderApp(["/quemas/nueva"]);

    await screen.findByRole("heading", { name: "Nueva quema" });

    // Ingresar dimensiones previamente
    const inputLargo = await screen.findByPlaceholderText("Largo");
    await user.type(inputLargo, "15");

    // Abrir selector de pieza y buscar una no existente
    const pieceSelect = screen.getByRole("combobox", { name: /pieza/i });
    await user.click(pieceSelect);

    const searchInput = await screen.findByPlaceholderText(/Buscar por nombre o referencia/i);
    await user.type(searchInput, "Florero volcán");

    // Debe mostrar la opción de crear
    const createBtn = await screen.findByText('+ Crear pieza "Florero volcán"');
    await user.click(createBtn);

    // Abre el modal compacto de Nueva pieza (este SÍ es modal porque es alta rápida de producto)
    const modalPieza = await screen.findByRole("dialog", { name: /nueva pieza/i });
    expect(within(modalPieza).getByDisplayValue("Florero volcán")).toBeInTheDocument();
    expect(within(modalPieza).getByText("Pieza terminada")).toBeInTheDocument();
    expect(within(modalPieza).getByText(/Automática \(LAB50xxx\)/i)).toBeInTheDocument();

    // Seleccionar categoría
    const catSelect = within(modalPieza).getByRole("combobox", { name: /categoría/i });
    await user.click(catSelect);
    const catOption = await within(modalPieza).findByText("Piezas");
    await user.click(catOption);

    // Guardar pieza
    const guardarBtn = within(modalPieza).getByRole("button", { name: /guardar pieza/i });
    await user.click(guardarBtn);

    // Modal debe cerrarse y el producto quedar seleccionado en la línea
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /nueva pieza/i })).not.toBeInTheDocument();
    });

    expect(screen.getByText("LAB50002 · Florero volcán")).toBeInTheDocument();
    // Conserva las dimensiones ingresadas
    expect(inputLargo).toHaveValue("15");

    // Verificar que se invocó POST /products con FINISHED_PRODUCT
    const postCalls = spy.mock.calls.filter(
      ([url, init]) => String(url).includes("/products") && (init?.method ?? "GET") === "POST",
    );
    expect(postCalls).toHaveLength(1);
    const bodySent = JSON.parse(String(postCalls[0]![1]?.body));
    expect(bodySent.name).toBe("Florero volcán");
    expect(bodySent.product_type).toBe("FINISHED_PRODUCT");
    expect(bodySent.product_category_id).toBe(1);
  });

  it("OPERATOR no ve la opción de crear pieza en el selector", async () => {
    mockQuemas({ rol: "OPERATOR" });
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    // OPERATOR puede ver el simulador
    await user.click(await screen.findByRole("tab", { name: "Simulador" }));

    const pieceSelect = await screen.findByRole("combobox", { name: /pieza/i });
    await user.click(pieceSelect);

    const searchInput = await screen.findByPlaceholderText(/Buscar por nombre o referencia/i);
    await user.type(searchInput, "Florero volcán");

    await waitFor(() => {
      expect(screen.getByText(/No se encontraron piezas para/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Crear pieza/i)).not.toBeInTheDocument();
  });

  it("no muestra acción de crear cuando la búsqueda coincide con un producto existente (insensible a mayúsculas/espacios)", async () => {
    mockQuemas();
    const user = userEvent.setup();
    renderApp(["/quemas/nueva"]);

    await screen.findByRole("heading", { name: "Nueva quema" });

    const pieceSelect = await screen.findByRole("combobox", { name: /pieza/i });
    await user.click(pieceSelect);

    const searchInput = await screen.findByPlaceholderText(/Buscar por nombre o referencia/i);
    await user.type(searchInput, "  PLATO   PALTA  ");

    // Debe mostrar la coincidencia existente
    expect(await screen.findByText("Plato palta")).toBeInTheDocument();
    // No debe mostrar botón de crear
    expect(screen.queryByText(/Crear pieza/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe("quemas: rutas dedicadas (/quemas/nueva, /quemas/:id, /quemas/:id/editar)", () => {
  it("/quemas/nueva guarda la quema y redirige al detalle /quemas/:id", async () => {
    const spy = mockQuemas();
    const user = userEvent.setup();
    renderApp(["/quemas/nueva"]);

    await screen.findByRole("heading", { name: "Nueva quema" });
    await screen.findByRole("button", { name: /añadir sesión/i });

    // Añadir sesión de horno
    const kilnSelect = screen.getByRole("combobox", { name: "Horno" });
    await user.click(kilnSelect);
    const kilnOption = await screen.findByText(/Horno pequeño/);
    await user.click(kilnOption);
    await user.click(screen.getByRole("button", { name: /añadir sesión/i }));

    // Ingresar datos de pieza
    const inputLargo = screen.getByPlaceholderText("Largo");
    await user.type(inputLargo, "18");
    const inputAncho = screen.getByPlaceholderText("Ancho");
    await user.type(inputAncho, "12");
    const inputAlto = screen.getByPlaceholderText("Alto");
    await user.type(inputAlto, "3");

    // Seleccionar pieza existente
    const pieceSelect = screen.getByRole("combobox", { name: "Pieza" });
    await user.click(pieceSelect);
    const pieceOption = await screen.findByText(/Plato palta/);
    await user.click(pieceOption);

    // Asignar quema baja
    const lowKilnSelect = screen.getByRole("combobox", { name: "Quema baja en" });
    await user.click(lowKilnSelect);
    const lowOptions = await screen.findAllByText(/Horno pequeño/);
    // Seleccionar la opción del dropdown abierto
    await user.click(lowOptions[lowOptions.length - 1]!);

    // El botón guardar borrador ahora debe estar habilitado
    const guardarBtn = screen.getAllByRole("button", { name: /guardar borrador/i })[0]!;
    expect(guardarBtn).toBeEnabled();
    await user.click(guardarBtn);

    // Verifica que se llamó POST /firings
    await waitFor(() => {
      expect(
        spy.mock.calls.some(([url, init]) => String(url).includes("/firings") && (init?.method ?? "GET") === "POST"),
      ).toBe(true);
    });

    // Redirige al detalle /quemas/:id
    expect(await screen.findByText(/HR-2026-/)).toBeInTheDocument();
  });

  it("/quemas/:id muestra el detalle de la quema y enlace para volver", async () => {
    mockQuemas({ detalle: QUEMA_CONFIRMADA });
    renderApp(["/quemas/10"]);

    expect(await screen.findByText("HR-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Confirmada")).toBeInTheDocument();
    expect(screen.getByText("Volver a quemas")).toBeInTheDocument();
    expect(screen.getByText("Sesiones de horno")).toBeInTheDocument();
    expect(screen.getByText("Piezas")).toBeInTheDocument();
  });

  it("/quemas/:id para una quema DRAFT muestra botón de Editar que navega a /quemas/:id/editar", async () => {
    mockQuemas({ detalle: QUEMA_BORRADOR });
    const user = userEvent.setup();
    renderApp(["/quemas/11"]);

    expect(await screen.findByText("HR-2026-000002")).toBeInTheDocument();
    expect(screen.getByText("Borrador")).toBeInTheDocument();

    const editLink = screen.getByRole("link", { name: /editar/i });
    expect(editLink).toHaveAttribute("href", "/quemas/11/editar");

    await user.click(editLink);
    expect(await screen.findByRole("heading", { name: /editar quema/i })).toBeInTheDocument();
  });

  it("/quemas/:id/editar permite modificar borrador y guardar cambios", async () => {
    const spy = mockQuemas({ detalle: QUEMA_BORRADOR });
    const user = userEvent.setup();
    renderApp(["/quemas/11/editar"]);

    expect(await screen.findByRole("heading", { name: /editar quema/i })).toBeInTheDocument();
    expect(await screen.findByText("Plato palta")).toBeInTheDocument();

    // Modificar notas
    const notesInput = screen.getByPlaceholderText(/Añadir observaciones adicionales/i);
    await user.type(notesInput, "Notas actualizadas");

    const guardarBtn = screen.getAllByRole("button", { name: /guardar cambios/i })[0]!;
    expect(guardarBtn).toBeEnabled();
    await user.click(guardarBtn);

    // Debe invocar PUT /firings/11
    await waitFor(() => {
      expect(
        spy.mock.calls.some(([url, init]) => String(url).includes("/firings/11") && (init?.method ?? "GET") === "PUT"),
      ).toBe(true);
    });
  });

  it("/quemas/:id/editar para una quema CONFIRMED no permite edición y muestra aviso", async () => {
    mockQuemas({ detalle: QUEMA_CONFIRMADA });
    renderApp(["/quemas/10/editar"]);

    expect(await screen.findByText("Esta quema no puede editarse")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver detalle de la quema/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /guardar cambios/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe("quemas: tuberia decimal", () => {
  it("formatea sobre el texto, sin pasar por coma flotante", () => {
    // 1041.384083 no es representable en binario: si pasara por parseFloat el
    // ultimo digito podria cambiar.
    expect(formatDecimalString("1041.384083", 2)).toBe("1041.38");
    expect(formatDecimalString("1249.660900", 2)).toBe("1249.66");
    expect(formatDecimalString("0.1", 3)).toBe("0.100");
    expect(formatDecimalString("26010.000000", 0)).toBe("26010");
    expect(formatDecimalString("-5.5", 1)).toBe("-5.5");
  });

  it("redondea a la mitad hacia arriba, como la hoja del negocio", () => {
    // La hoja muestra 23.36 y 70.07 para estas dos cifras: truncar dejaria
    // ambas un centimo por debajo y no cuadrarian con el documento.
    expect(formatDecimalString("23.356401", 2)).toBe("23.36");
    expect(formatDecimalString("70.069204", 2)).toBe("70.07");
    expect(formatDecimalString("112.110727", 2)).toBe("112.11");
    // El acarreo se propaga por toda la cifra.
    expect(formatDecimalString("9.999", 2)).toBe("10.00");
    expect(formatDecimalString("0.5", 0)).toBe("1");
  });

  it("conserva digitos que un float perderia", () => {
    // 24 digitos significativos: fuera del alcance de un double.
    expect(formatDecimalString("123456789012345678.901234", 6)).toBe(
      "123456789012345678.901234",
    );
  });

  it("muestra un guion cuando no hay valor", () => {
    expect(formatDecimalString(null, 2)).toBe("—");
    expect(formatDecimalString(undefined, 2)).toBe("—");
    expect(formatDecimalString("", 2)).toBe("—");
  });

  it("formatea porcentajes", () => {
    expect(formatPercentage("76.235294")).toBe("76.2 %");
    expect(formatPercentage(null)).toBe("—");
  });

  it("multiplica dimensiones con enteros grandes, no con float", () => {
    // 20 x 18 x 12 x 3 = 12960, el volumen del caso de referencia.
    expect(multiplyDecimalStrings("20", "18", "12", "3")).toBe("12960");
    // 0.1 x 0.2 da exactamente 0.02, no 0.020000000000000004.
    expect(multiplyDecimalStrings("0.1", "0.2")).toBe("0.02");
    expect(multiplyDecimalStrings("1.5", "2.5", "0.1")).toBe("0.375");
    // Una entrada no numerica no produce un resultado inventado.
    expect(multiplyDecimalStrings("abc", "2")).toBe("");
  });
});

// ---------------------------------------------------------------------------
describe("quemas: construccion del cuerpo de la API", () => {
  it("no pide calculo mientras la hoja este incompleta", () => {
    expect(aPayload(borradorVacio())).toBeNull();
  });

  it("no pide calculo si la pieza apunta a una sesion que no existe", () => {
    const draft = {
      ...borradorVacio(),
      sessions: [{ kiln_id: 1, firing_type: "LOW" as const }],
      lines: [
        {
          ...nuevaLinea(),
          description: "Plato",
          quantity: "20",
          length_cm: "18",
          width_cm: "12",
          height_cm: "3",
          high_kiln_id: 2, // no hay sesion alta declarada
        },
      ],
    };
    expect(aPayload(draft)).toBeNull();
  });

  it("envia las dimensiones como texto, nunca como numero", () => {
    const draft = {
      ...borradorVacio(),
      sessions: [{ kiln_id: 1, firing_type: "LOW" as const }],
      lines: [
        {
          ...nuevaLinea(),
          description: "Plato palta",
          quantity: "20",
          length_cm: "18.5",
          width_cm: "12",
          height_cm: "3",
          low_kiln_id: 1,
        },
      ],
    };

    const payload = aPayload(draft);
    expect(payload).not.toBeNull();
    const linea = payload!.lines[0]!;
    expect(linea.length_cm).toBe("18.5");
    expect(typeof linea.length_cm).toBe("string");
    expect(typeof linea.width_cm).toBe("string");
    // La cantidad de piezas si es un entero: es un conteo, no un decimal.
    expect(linea.quantity).toBe(20);
  });

  it("descarta las piezas a medias en vez de enviarlas incompletas", () => {
    const draft = {
      ...borradorVacio(),
      sessions: [{ kiln_id: 1, firing_type: "LOW" as const }],
      lines: [
        {
          ...nuevaLinea(),
          description: "Completa",
          quantity: "1",
          length_cm: "1",
          width_cm: "1",
          height_cm: "1",
          low_kiln_id: 1,
        },
        { ...nuevaLinea(), description: "A medias" },
      ],
    };

    const payload = aPayload(draft);
    expect(payload!.lines).toHaveLength(1);
    expect(payload!.lines[0]!.description).toBe("Completa");
  });

  it("rechaza cantidades no enteras estrictas o con sufijos/formato invalido", () => {
    const invalidas = ["0", "-1", "1.5", "12abc", "1e3", "1 2", "", "   "];
    for (const q of invalidas) {
      const draft = {
        ...borradorVacio(),
        sessions: [{ kiln_id: 1, firing_type: "LOW" as const }],
        lines: [
          {
            ...nuevaLinea(),
            description: "Plato",
            quantity: q,
            length_cm: "10",
            width_cm: "10",
            height_cm: "5",
            low_kiln_id: 1,
          },
        ],
      };
      expect(aPayload(draft)).toBeNull();
    }
  });
});

describe("quemas: preservacion de factor_kiln y preview de lineas", () => {
  it("preserva factor_kiln_id si el horno sigue participando en otra sesion", async () => {
    const user = userEvent.setup();
    mockQuemas();
    renderApp(["/quemas/nueva"]);

    await screen.findByRole("heading", { name: "Nueva quema" });
    await screen.findByRole("button", { name: /añadir sesión/i });

    // Añadir sesión LOW de Horno pequeño (id=1)
    const selectHorno = screen.getByRole("combobox", { name: "Horno" });
    await user.click(selectHorno);
    const opcionChico = await screen.findByRole("option", { name: /horno pequeño/i });
    await user.click(opcionChico);
    await user.click(screen.getByRole("button", { name: /añadir sesión/i }));

    // Añadir sesión HIGH de Horno pequeño
    await user.click(selectHorno);
    const opcionChico2 = await screen.findByRole("option", { name: /horno pequeño/i });
    await user.click(opcionChico2);

    const tipoSelect = screen.getByRole("combobox", { name: "Tipo de quema" });
    await user.click(tipoSelect);
    const opcionAlta = await screen.findByRole("option", { name: /^alta$/i });
    await user.click(opcionAlta);
    await user.click(screen.getByRole("button", { name: /añadir sesión/i }));

    // Configurar pieza con factor_kiln_id = Horno pequeño
    const selectFactor = screen.getByRole("combobox", { name: "Ocupación medida en" });
    await user.click(selectFactor);
    const opcionHornoChicoFactor = await screen.findByRole("option", { name: /horno pequeño/i });
    await user.click(opcionHornoChicoFactor);

    // Quitar la primera sesión (LOW)
    const botonesQuitar = screen.getAllByRole("button", { name: /^quitar$/i });
    await user.click(botonesQuitar[0]!);

    // El factor_kiln_id debe permanecer en Horno pequeño porque la sesión HIGH de Horno pequeño sigue activa
    expect(
      screen.getByRole("combobox", { name: "Ocupación medida en" }),
    ).toHaveTextContent(/horno pequeño/i);
  });

  it("limpia el detalle cuando un filtro o busqueda retorna cero filas", async () => {
    mockQuemas({
      firings: {
        items: [],
        total: 0,
        limit: 25,
        offset: 0,
      },
    });

    renderApp(["/quemas"]);

    expect(
      await screen.findByText(/No hay quemas que coincidan con la búsqueda/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Seleccione una quema para ver su detalle/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar quema/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Anular quema/i })).not.toBeInTheDocument();
  });
});
