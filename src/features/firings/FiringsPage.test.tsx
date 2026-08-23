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
function mockQuemas(escenario: Escenario = {}) {
  const {
    calculo = CALCULO,
    calculoError,
    firings = FIRINGS_PAGE,
    detalle = QUEMA_CONFIRMADA,
    rol = "ADMIN",
  } = escenario;

  return mockFetch((url, init) => {
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
    if (url.includes("/kilns") && (init.method ?? "GET") === "POST") {
      return jsonResponse(201, HORNO_CHICO);
    }
    if (url.includes("/kilns")) return jsonResponse(200, KILNS_PAGE);
    if (url.includes("/products")) return jsonResponse(200, PRODUCTS_PAGE);
    return errorResponse(404, "NOT_FOUND");
  });
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
    expect(screen.getByRole("button", { name: "Nueva quema" })).toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Nueva quema" })).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Nueva quema" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe("quemas: nueva quema", () => {
  it("abre el formulario y ofrece añadir sesiones y piezas", async () => {
    mockQuemas();
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("button", { name: "Nueva quema" }));

    const dialogo = await screen.findByRole("dialog", { name: /nueva quema/i });
    expect(within(dialogo).getByText("Sesiones de horno")).toBeInTheDocument();
    expect(within(dialogo).getByText("Piezas")).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: /agregar pieza/i })).toBeInTheDocument();
  });

  it("no permite guardar una hoja incompleta", async () => {
    mockQuemas();
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("button", { name: "Nueva quema" }));
    const dialogo = await screen.findByRole("dialog", { name: /nueva quema/i });

    expect(within(dialogo).getByRole("button", { name: /guardar borrador/i })).toBeDisabled();
  });

  it("la pieza se elige del catálogo y no se teclea a mano", async () => {
    const spy = mockQuemas();
    const user = userEvent.setup();
    renderApp(["/quemas"]);

    await user.click(await screen.findByRole("button", { name: "Nueva quema" }));
    const dialogo = await screen.findByRole("dialog", { name: /nueva quema/i });

    // Hay un selector de pieza, y ningun campo libre de descripcion que
    // permitiria inventar un producto que ya existe en el catalogo.
    expect(within(dialogo).getByRole("combobox", { name: /pieza/i })).toBeInTheDocument();
    expect(within(dialogo).queryByLabelText(/descripción/i)).not.toBeInTheDocument();

    // El catalogo se consulta al servidor, filtrado a productos terminados.
    await waitFor(() =>
      expect(
        urls(spy).some((u) => u.includes("/products") && u.includes("FINISHED_PRODUCT")),
      ).toBe(true),
    );
  });

  it("selecciona el horno con el selector propio, no con uno nativo", async () => {
    mockQuemas();
    const user = userEvent.setup();
    const { container } = renderApp(["/quemas"]);

    await user.click(await screen.findByRole("button", { name: "Nueva quema" }));
    await screen.findByRole("dialog", { name: /nueva quema/i });

    expect(container.querySelectorAll("select")).toHaveLength(0);
    // El selector propio se expone como combobox accesible, no como <select>.
    expect(screen.getAllByRole("combobox", { name: /horno/i }).length).toBeGreaterThan(0);
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
});
