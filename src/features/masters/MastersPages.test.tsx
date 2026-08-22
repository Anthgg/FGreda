import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  CATEGORIES,
  IMPORT_BATCH,
  IMPORT_PREVIEW,
  MOVEMENTS_PAGE,
  PARTNERS_PAGE,
  POS_CATEGORIES,
  PRODUCTS_PAGE,
  STOCK_PAGE,
  UNITS,
} from "@/test/mastersFixtures";
import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderApp,
  sessionResponse,
  TEST_USER,
} from "@/test/utils";
import type { SessionUser } from "@/types/auth";

const OPERATOR: SessionUser = { ...TEST_USER, display_name: "Operario", role: "OPERATOR" };

interface Overrides {
  user?: SessionUser;
  onRequest?: (url: string, init: RequestInit) => Response | undefined;
}

/** Respuestas de todo lo que piden los modulos de Fase 3. */
function mockMasters(overrides: Overrides = {}) {
  return mockFetch((url, init) => {
    const custom = overrides.onRequest?.(url, init);
    if (custom) return custom;

    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return sessionResponse(overrides.user ?? TEST_USER);
    if (url.includes("/pos-categories")) return jsonResponse(200, POS_CATEGORIES);
    if (url.includes("/categories")) return jsonResponse(200, CATEGORIES);
    if (url.includes("/units")) return jsonResponse(200, UNITS);
    if (url.includes("/products")) return jsonResponse(200, PRODUCTS_PAGE);
    if (url.includes("/partners")) return jsonResponse(200, PARTNERS_PAGE);
    if (url.includes("/inventory/locations"))
      return jsonResponse(200, [{ id: 1, name: "Mariano Pastor", active: true }]);
    if (url.includes("/inventory/movements")) return jsonResponse(200, MOVEMENTS_PAGE);
    if (url.includes("/inventory")) return jsonResponse(200, STOCK_PAGE);
    if (url.includes("/imports/1/preview")) return jsonResponse(200, IMPORT_PREVIEW);
    if (url.includes("/imports/1")) return jsonResponse(200, IMPORT_BATCH);
    if (url.includes("/imports")) return jsonResponse(200, { items: [IMPORT_BATCH], total: 1 });
    return errorResponse(404, "NOT_FOUND");
  });
}

describe("Modulo de productos", () => {
  it("lista el maestro con su referencia, categoria y costo completo", async () => {
    mockMasters();
    renderApp(["/productos"]);

    expect(await screen.findByText("Arcilla blanca")).toBeInTheDocument();
    expect(screen.getByText("INS-1")).toBeInTheDocument();
    expect(screen.getByText("Insumos Taller / Pastas")).toBeInTheDocument();
    // El costo no se redondea al mostrarlo: solo se recorta la cola de ceros.
    expect(screen.getByText("0.016906843137")).toBeInTheDocument();
  });

  it("la busqueda la resuelve el servidor", async () => {
    const spy = mockMasters();
    renderApp(["/productos"]);
    await screen.findByText("Arcilla blanca");

    await userEvent.type(screen.getByLabelText("Buscar producto"), "arcilla");

    await waitFor(() => {
      const urls = spy.mock.calls.map((call) => String(call[0]));
      expect(urls.some((url) => url.includes("search=arcilla"))).toBe(true);
    });
  });

  it("el filtro por tipo viaja al backend", async () => {
    const spy = mockMasters();
    renderApp(["/productos"]);
    await screen.findByText("Arcilla blanca");

    await userEvent.click(screen.getByRole("combobox", { name: /Tipo/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Servicio" }));

    await waitFor(() => {
      const urls = spy.mock.calls.map((call) => String(call[0]));
      expect(urls.some((url) => url.includes("product_type=SERVICE"))).toBe(true);
    });
  });

  it("los selects son propios, no del sistema operativo", async () => {
    mockMasters();
    const { container } = renderApp(["/productos"]);
    await screen.findByText("Arcilla blanca");

    expect(container.querySelectorAll("select")).toHaveLength(0);
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
  });

  it("el desplegable trae mini buscador y filtra", async () => {
    mockMasters();
    renderApp(["/productos"]);
    await screen.findByText("Arcilla blanca");

    await userEvent.click(screen.getByRole("combobox", { name: /Categoría/ }));
    const search = await screen.findByPlaceholderText("Buscar categoría...");
    await userEvent.type(search, "pastas");

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Insumos Taller / Pastas");
  });

  it("un OPERATOR no ve las acciones de escritura", async () => {
    mockMasters({ user: OPERATOR });
    renderApp(["/productos"]);
    await screen.findByText("Arcilla blanca");

    expect(screen.queryByRole("button", { name: "Nuevo producto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("el alta exige unidad salvo en un servicio", async () => {
    mockMasters();
    renderApp(["/productos"]);
    await userEvent.click(await screen.findByRole("button", { name: "Nuevo producto" }));

    await userEvent.type(screen.getByLabelText(/Referencia interna/), "INS-9");
    await userEvent.type(screen.getByLabelText(/^Nombre/), "Arcilla nueva");
    const submit = screen.getByRole("button", { name: "Crear producto" });
    expect(submit).toBeDisabled();

    await userEvent.click(screen.getByRole("combobox", { name: "Tipo" }));
    await userEvent.click(await screen.findByRole("option", { name: "Servicio" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Categoría" }));
    await userEvent.click(await screen.findByRole("option", { name: "Insumos Taller" }));

    expect(screen.getByRole("button", { name: "Crear producto" })).toBeEnabled();
  });
});

describe("Backend equivocado", () => {
  it("un 404 en toda la API no se muestra como 'Not Found' en ingles", async () => {
    // Reproduce el incidente del user test: la aplicacion apuntaba al backend
    // de Fase 2, que no conoce estas rutas, y la pantalla mostraba el texto
    // crudo del servidor en vez de explicar que pasaba.
    mockMasters({
      onRequest: (url) =>
        url.includes("/products") || url.includes("/categories")
          ? errorResponse(404, "NOT_FOUND", "Not Found")
          : undefined,
    });
    renderApp(["/productos"]);

    expect(
      await screen.findByText(/Verifique que la aplicacion apunte al backend correcto/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Not Found")).not.toBeInTheDocument();
  });

  it("el inventario tampoco filtra el texto crudo del servidor", async () => {
    mockMasters({
      onRequest: (url) =>
        url.includes("/inventory") ? errorResponse(404, "NOT_FOUND", "Not Found") : undefined,
    });
    renderApp(["/inventario"]);

    expect(
      await screen.findByText(/Verifique que la aplicacion apunte al backend correcto/),
    ).toBeInTheDocument();
  });
});

describe("Modulo de terceros", () => {
  it("muestra clientes y proveedores en un unico maestro", async () => {
    mockMasters();
    renderApp(["/terceros"]);

    expect(await screen.findByText("Proveedor de prueba S.A.")).toBeInTheDocument();
    expect(screen.getByText("RUC 20999999999")).toBeInTheDocument();
    expect(screen.getByText("Proveedor")).toBeInTheDocument();
  });

  it("el filtro de rol viaja al backend", async () => {
    const spy = mockMasters();
    renderApp(["/terceros"]);
    await screen.findByText("Proveedor de prueba S.A.");

    await userEvent.click(screen.getByRole("combobox", { name: /Rol/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Clientes" }));

    await waitFor(() => {
      const urls = spy.mock.calls.map((call) => String(call[0]));
      expect(urls.some((url) => url.includes("role=CLIENT"))).toBe(true);
    });
  });

  it("el tipo y el numero de documento van juntos", async () => {
    mockMasters();
    renderApp(["/terceros"]);
    await userEvent.click(await screen.findByRole("button", { name: "Nuevo tercero" }));

    await userEvent.type(screen.getByLabelText(/Nombre o razón social/), "Cliente nuevo");
    await userEvent.type(screen.getByLabelText(/Número de documento/), "12345678");

    expect(await screen.findByText("El tipo y el número de documento van juntos.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Crear tercero" })).toBeDisabled();
  });
});

describe("Modulo de inventario", () => {
  it("muestra la existencia por producto y ubicacion", async () => {
    mockMasters();
    renderApp(["/inventario"]);

    expect(await screen.findByText("Arcilla blanca")).toBeInTheDocument();
    expect(screen.getByText("Mariano Pastor")).toBeInTheDocument();
    expect(screen.getByText("120.000000000000")).toBeInTheDocument();
  });

  it("el saldo no es un campo editable", async () => {
    mockMasters();
    const { container } = renderApp(["/inventario"]);
    await screen.findByText("Arcilla blanca");

    const row = screen.getByText("120.000000000000").closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).queryByRole("textbox")).not.toBeInTheDocument();
    expect(container.querySelectorAll("input[type='number']")).toHaveLength(0);
  });

  it("un ajuste pide cantidad y motivo antes de enviarse", async () => {
    const spy = mockMasters({
      onRequest: (url, init) =>
        url.includes("/inventory/adjustments") && init.method === "POST"
          ? jsonResponse(201, MOVEMENTS_PAGE.items[0])
          : undefined,
    });
    renderApp(["/inventario"]);
    await userEvent.click(await screen.findByRole("button", { name: "Ajustar" }));

    const submit = screen.getByRole("button", { name: "Registrar ajuste" });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Cantidad a sumar o restar/), "-20");
    await userEvent.type(screen.getByLabelText(/Motivo/), "Merma de horno");
    await userEvent.click(screen.getByRole("button", { name: "Registrar ajuste" }));

    await waitFor(() => {
      const call = spy.mock.calls.find(([url]) =>
        String(url).includes("/inventory/adjustments"),
      );
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
        quantity: "-20",
        reason: "Merma de horno",
      });
    });
  });

  it("el OPERATOR consulta pero no ajusta", async () => {
    mockMasters({ user: OPERATOR });
    renderApp(["/inventario"]);
    await screen.findByText("Arcilla blanca");

    expect(screen.queryByRole("button", { name: "Ajustar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Historial" })).toBeInTheDocument();
  });

  it("el historial muestra el movimiento que respalda el saldo", async () => {
    mockMasters();
    renderApp(["/inventario"]);
    await userEvent.click(await screen.findByRole("button", { name: "Historial" }));

    expect(await screen.findByText("Carga inicial")).toBeInTheDocument();
    expect(screen.getByText("Importacion inicial (lote 1)")).toBeInTheDocument();
  });
});

describe("Modulo de importaciones", () => {
  it("no hay boton de confirmar antes de subir nada", async () => {
    mockMasters();
    renderApp(["/importaciones"]);

    expect(await screen.findByLabelText("Archivo de maestros")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar importación/ })).not.toBeInTheDocument();
  });

  it("tras subir muestra el resumen y el preview sin escribir nada", async () => {
    const spy = mockMasters({
      onRequest: (url, init) =>
        url.includes("/imports/master/upload") && init.method === "POST"
          ? jsonResponse(201, IMPORT_BATCH)
          : undefined,
    });
    renderApp(["/importaciones"]);

    const file = new File(["x"], "maestros.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await userEvent.upload(await screen.findByLabelText("Archivo de maestros"), file);

    expect(await screen.findByText("2 · Resumen del análisis")).toBeInTheDocument();
    expect(screen.getByText("Creaciones")).toBeInTheDocument();
    expect(
      screen.getByText(/Recetas detectadas: 3 \(9 líneas\) · importadas: 0/),
    ).toBeInTheDocument();

    // Ninguna llamada escribio en los maestros.
    const writes = spy.mock.calls.filter(
      ([url, init]) =>
        (init as RequestInit | undefined)?.method === "POST" &&
        !String(url).includes("/imports/") &&
        !String(url).includes("/auth/"),
    );
    expect(writes).toHaveLength(0);
  });

  it("el aviso de redondeo muestra el valor original junto al normalizado", async () => {
    mockMasters({
      onRequest: (url, init) =>
        url.includes("/imports/master/upload") && init.method === "POST"
          ? jsonResponse(201, IMPORT_BATCH)
          : undefined,
    });
    renderApp(["/importaciones"]);
    await userEvent.upload(
      await screen.findByLabelText("Archivo de maestros"),
      new File(["x"], "maestros.xlsx"),
    );

    expect(await screen.findByText("ROUNDED_TO_12_DECIMALS")).toBeInTheDocument();
    expect(
      screen.getByText("(0.0169068431372549 → 0.016906843137)"),
    ).toBeInTheDocument();
  });

  it("no deja confirmar mientras haya filas por resolver", async () => {
    mockMasters({
      onRequest: (url, init) =>
        url.includes("/imports/master/upload") && init.method === "POST"
          ? jsonResponse(201, IMPORT_BATCH)
          : undefined,
    });
    renderApp(["/importaciones"]);
    await userEvent.upload(
      await screen.findByLabelText("Archivo de maestros"),
      new File(["x"], "maestros.xlsx"),
    );

    const button = await screen.findByRole("button", { name: "Revisar y confirmar" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Quedan 1 filas por resolver.")).toBeInTheDocument();
  });

  it("clasificar un tercero envia la resolucion elegida", async () => {
    const spy = mockMasters({
      onRequest: (url, init) => {
        if (url.includes("/imports/master/upload") && init.method === "POST") {
          return jsonResponse(201, IMPORT_BATCH);
        }
        if (url.includes("/imports/1/resolve")) return jsonResponse(200, IMPORT_BATCH);
        return undefined;
      },
    });
    renderApp(["/importaciones"]);
    await userEvent.upload(
      await screen.findByLabelText("Archivo de maestros"),
      new File(["x"], "maestros.xlsx"),
    );

    await userEvent.click(await screen.findByRole("combobox", { name: /Clasificar/ }));
    await userEvent.click(await screen.findByRole("option", { name: "Proveedor" }));
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    await waitFor(() => {
      const call = spy.mock.calls.find(([url]) => String(url).includes("/imports/1/resolve"));
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        resolutions: [{ row_id: 11, partner_role: "SUPPLIER", accept_suggestion: true }],
      });
    });
  });

  it("un OPERATOR no puede subir el archivo", async () => {
    mockMasters({ user: OPERATOR });
    renderApp(["/importaciones"]);

    expect(await screen.findByLabelText("Archivo de maestros")).toBeDisabled();
    expect(
      screen.getByText("Solo un administrador puede importar maestros."),
    ).toBeInTheDocument();
  });
});
