import { act, type ReactElement } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { V2NextProductsStep } from "./V2NextProductsStep";
import { COTIZACION } from "@/test/v2next/shellFixtures";
import { CUSTOM_PIECE, CATALOG_PIECE } from "@/test/v2next/productsFixtures";
import { vaciarRegistroDeBorradores } from "@/components/borradores";
import { jsonResponse } from "@/test/utils";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";
import type { Product } from "@/types/masters";
import type {
  V2QuotationProduct,
  V2QuotationProductsPage,
} from "@/types/quoterV2Materials";

type ProductsQueryMock = {
  data?: V2QuotationProductsPage;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

const PRODUCTO_CATALOGO: Product = {
  id: 101,
  internal_reference: "PZA-101",
  name: "Plato Nuevo",
  product_type: "FINISHED_PRODUCT",
  product_category_id: 1,
  product_category_path: "Piezas",
  pos_category_id: null,
  pos_category_name: null,
  base_uom_code: "und",
  purchase_uom_code: null,
  cost: null,
  sale_price: null,
  sale_tax_rate: null,
  purchase_tax_rate: null,
  material: null,
  grammage: null,
  width: null,
  height: null,
  length: null,
  depth: null,
  sellable: true,
  purchasable: false,
  available_in_pos: true,
  active: true,
  notes: null,
};

const paginaConPiezas = (items: V2QuotationProduct[]): V2QuotationProductsPage => ({
  items,
  materials_cost: "0",
});

const hooks = {
  productsQuery: {
    data: paginaConPiezas([CATALOG_PIECE, CUSTOM_PIECE]),
    isPending: false,
    isError: false,
    error: null,
  } as ProductsQueryMock,
  actualizar: { mutate: vi.fn() },
  borrar: { mutate: vi.fn() },
  anadir: {
    mutate: vi.fn((_vars: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    }),
    isPending: false,
    isError: false,
    error: null,
  },
  esperar: vi.fn((_mut, _key, vars: unknown) => {
    hooks.actualizar.mutate(vars);
    return Promise.resolve({ ok: true, firma: "linea", fresco: true });
  }),
};

vi.mock("@/features/cotizadorV2/useQuoterV2Materials", () => ({
  useV2QuotationProducts: vi.fn(() => hooks.productsQuery),
  useUpdateV2QuotationProduct: vi.fn(() => hooks.actualizar),
  useDeleteV2QuotationProduct: vi.fn(() => hooks.borrar),
  useAddV2QuotationProduct: vi.fn(() => hooks.anadir),
}));
vi.mock("@/features/cotizadorV2/claves", () => ({
  useEsperarGuardado: vi.fn(() => hooks.esperar),
}));

const PROPS = {
  quotationId: 7,
  canEdit: true,
  datos: {
    cotizacion: COTIZACION,
    productos: paginaConPiezas([CATALOG_PIECE, CUSTOM_PIECE]),
    manoDeObra: undefined,
    quema: undefined,
    precio: undefined,
  },
  estados: [],
  irAPaso: vi.fn(),
} satisfies PasoDelAsistenteProps;

function renderConProvider(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function mockCatalogo(productos: Product[] = [PRODUCTO_CATALOGO]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/products")) {
      return jsonResponse(200, {
        items: productos,
        total: productos.length,
        limit: 30,
        offset: 0,
      });
    }
    return jsonResponse(200, { items: [], total: 0, limit: 30, offset: 0 });
  });
}

describe("V2NextProductsStep", () => {
  let globalFetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vaciarRegistroDeBorradores();
    hooks.productsQuery.data = paginaConPiezas([CATALOG_PIECE, CUSTOM_PIECE]);
    hooks.productsQuery.isPending = false;
    hooks.productsQuery.isError = false;
    hooks.productsQuery.error = null;
    hooks.anadir.isPending = false;
    hooks.anadir.isError = false;
    hooks.anadir.error = null;
    globalFetchSpy = mockCatalogo();
    vi.stubGlobal("fetch", globalFetchSpy);
  });

  it("muestra carga y error del listado de piezas", () => {
    hooks.productsQuery.isPending = true;
    const { rerender } = renderConProvider(<V2NextProductsStep {...PROPS} />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando piezas...");

    hooks.productsQuery.isPending = false;
    hooks.productsQuery.isError = true;
    hooks.productsQuery.error = new Error("fallo de prueba");
    rerender(<V2NextProductsStep {...PROPS} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/error inesperado/i);
  });

  it("renderiza piezas editables sin costos y con avisos en palabras", () => {
    renderConProvider(<V2NextProductsStep {...PROPS} />);

    expect(screen.getByText("Plato hondo")).toBeInTheDocument();
    expect(screen.getByText("Taza personalizada")).toBeInTheDocument();
    expect(screen.getByText("Hay un aviso pendiente de revisar en esta pieza.")).toBeInTheDocument();
    expect(screen.queryByText("NO_BODY")).not.toBeInTheDocument();
    expect(screen.queryByText(/S\//)).not.toBeInTheDocument();
    expect(screen.queryByText(/costo/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox", { name: /^Largo/ })).toHaveLength(2);
  });

  it("sin canEdit muestra valores como dl, sin inputs ni botones de edición", () => {
    renderConProvider(<V2NextProductsStep {...PROPS} canEdit={false} />);

    expect(screen.queryByLabelText("Cantidad")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(/20.0 L/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quitar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar pieza" })).not.toBeInTheDocument();
    expect(screen.queryByText("Tiempo por pieza")).not.toBeInTheDocument();
  });

  it("serializa horas y minutos a minutos exactos y guarda mold_count entero", async () => {
    const user = userEvent.setup();
    const props010P = {
      ...PROPS,
      datos: { ...PROPS.datos, cotizacion: { ...COTIZACION, pricing_rules_version: 2 } },
    };
    renderConProvider(<V2NextProductsStep {...props010P} />);

    const horas = screen.getAllByLabelText("Horas")[0]!;
    const minutos = screen.getAllByLabelText("Minutos")[0]!;
    await user.type(horas, "1");
    await user.type(minutos, "30");
    await user.tab();
    await user.tab();

    expect(hooks.actualizar.mutate).toHaveBeenCalledWith({
      lineId: 2,
      payload: { production_time_per_unit_minutes: "90" },
    });

    const moldes = screen.getAllByLabelText("Moldes")[0]!;
    await user.clear(moldes);
    await user.type(moldes, "3");
    await user.tab();
    expect(hooks.actualizar.mutate).toHaveBeenCalledWith({
      lineId: 2,
      payload: { mold_count: 3 },
    });
  });

  it("muestra tiempo, moldes y cálculos del backend en una pieza 010P de sólo lectura", () => {
    const pieza010P = {
      ...CUSTOM_PIECE,
      quantity: 30,
      production_time_per_unit_minutes: "45.000000",
      mold_count: 3,
      cycles: 10,
      line_active_minutes: "450.000000",
    };
    hooks.productsQuery.data = paginaConPiezas([pieza010P]);
    renderConProvider(
      <V2NextProductsStep
        {...PROPS}
        canEdit={false}
        datos={{ ...PROPS.datos, cotizacion: { ...COTIZACION, pricing_rules_version: 2 } }}
      />,
    );

    expect(screen.getByText(/45(?:\.00)? min/)).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText(/7 h 30(?:\.00)? min/)).toBeInTheDocument();
  });

  it("agrega una pieza de catálogo con product_id y búsqueda FINISHED_PRODUCT", async () => {
    hooks.productsQuery.data = paginaConPiezas([]);
    const user = userEvent.setup();

    renderConProvider(<V2NextProductsStep {...PROPS} />);
    await user.click(screen.getByRole("button", { name: "Agregar pieza" }));
    await user.click(screen.getByRole("combobox", { name: "Buscar en catálogo o escribir nombre" }));
    await user.type(screen.getByPlaceholderText("Busca o escribe el nombre..."), "Plato");
    await user.click(await screen.findByText("Plato Nuevo"));

    expect(hooks.anadir.mutate).toHaveBeenCalledWith(
      { product_id: 101, quantity: 1 },
      expect.any(Object),
    );

    const llamadasAProductos = globalFetchSpy.mock.calls
      .map(([input]) => new URL(String(input), "http://localhost"))
      .filter((url) => url.pathname === "/api/v1/products");
    expect(llamadasAProductos.length).toBeGreaterThan(0);
    expect(
      llamadasAProductos.some((url) => url.searchParams.get("product_type") === "FINISHED_PRODUCT"),
    ).toBe(true);
  });

  it("agrega una pieza a medida con product_name", async () => {
    hooks.productsQuery.data = paginaConPiezas([]);
    globalFetchSpy = mockCatalogo([]);
    vi.stubGlobal("fetch", globalFetchSpy);
    const user = userEvent.setup();

    renderConProvider(<V2NextProductsStep {...PROPS} />);
    await user.click(screen.getByRole("button", { name: "Agregar pieza" }));
    await user.click(screen.getByRole("combobox", { name: "Buscar en catálogo o escribir nombre" }));
    await user.type(screen.getByPlaceholderText("Busca o escribe el nombre..."), "Nueva cosa");
    // La opción de crear aparece tras el debounce del buscador: con la suite
    // entera en paralelo eso pasa del segundo por defecto.
    await user.click(await screen.findByText("Pieza a medida «Nueva cosa»", {}, { timeout: 5000 }));

    expect(hooks.anadir.mutate).toHaveBeenCalledWith(
      { product_name: "Nueva cosa", quantity: 1 },
      expect.any(Object),
    );
  });

  it("cantidad por stepper hace un solo PUT tras la pausa", async () => {
    vi.useFakeTimers();
    try {
      renderConProvider(<V2NextProductsStep {...PROPS} />);

      const masCatalogo = screen.getAllByRole("button", { name: "Más" })[0]!;
      fireEvent.click(masCatalogo);
      fireEvent.click(masCatalogo);
      fireEvent.click(masCatalogo);
      fireEvent.click(masCatalogo);
      fireEvent.click(masCatalogo);

      expect(hooks.esperar).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      expect(hooks.esperar).toHaveBeenCalledTimes(1);
      expect(hooks.actualizar.mutate).toHaveBeenCalledWith({
        lineId: 2,
        payload: { quantity: 6 },
      });
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("cantidad tecleada guarda una sola vez al salir del grupo", async () => {
    const user = userEvent.setup();
    renderConProvider(<V2NextProductsStep {...PROPS} />);

    const tarjetaCatalogo = screen.getByRole("heading", { name: "Plato hondo" }).closest(".group");
    expect(tarjetaCatalogo).not.toBeNull();
    const cantidadCatalogo = within(tarjetaCatalogo as HTMLElement).getByRole("textbox", {
      name: "Cantidad",
    });
    await user.click(cantidadCatalogo);
    await user.keyboard("{Control>}a{/Control}10");
    await user.tab();
    await user.tab();

    expect(hooks.esperar).toHaveBeenCalledTimes(1);
    expect(hooks.actualizar.mutate).toHaveBeenCalledWith({
      lineId: 2,
      payload: { quantity: 10 },
    });
  });

  it("medidas editables en pieza de catálogo mandan decimal y null si se vacía", async () => {
    const user = userEvent.setup();
    renderConProvider(<V2NextProductsStep {...PROPS} />);

    const largoCatalogo = screen.getAllByRole("textbox", { name: /^Largo/ })[0]!;
    await user.clear(largoCatalogo);
    await user.type(largoCatalogo, "21,5");
    await user.tab();

    expect(hooks.actualizar.mutate).toHaveBeenCalledWith({
      lineId: 2,
      payload: { length_cm: "21.5" },
    });

    await user.clear(largoCatalogo);
    await user.tab();

    expect(hooks.actualizar.mutate).toHaveBeenCalledWith({
      lineId: 2,
      payload: { length_cm: null },
    });
  });

  it("guarda observación para el cliente", async () => {
    const user = userEvent.setup();
    renderConProvider(<V2NextProductsStep {...PROPS} />);

    const notaCustom = screen.getAllByRole("textbox", { name: /^Nota para el cliente/ })[1]!;
    await user.clear(notaCustom);
    await user.type(notaCustom, "Nueva nota");
    await user.tab();

    expect(hooks.actualizar.mutate).toHaveBeenCalledWith({
      lineId: 1,
      payload: { client_observation: "Nueva nota" },
    });
  });

  it("quita con diálogo por portal y Escape devuelve el foco sin borrar", async () => {
    const user = userEvent.setup();
    renderConProvider(<V2NextProductsStep {...PROPS} />);

    const botonQuitar = screen.getByRole("button", { name: "Quitar Plato hondo" });
    await user.click(botonQuitar);

    const dialog = screen.getByRole("dialog", { name: "¿Quitar pieza?" });
    expect(dialog).toBeInTheDocument();
    expect(dialog.parentElement?.parentElement).toBe(document.body);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "¿Quitar pieza?" })).not.toBeInTheDocument();
    expect(hooks.borrar.mutate).not.toHaveBeenCalled();
    expect(botonQuitar).toHaveFocus();

    await user.click(botonQuitar);
    await user.click(
      within(screen.getByRole("dialog", { name: "¿Quitar pieza?" })).getByRole("button", {
        name: "Quitar pieza",
      }),
    );

    expect(hooks.borrar.mutate).toHaveBeenCalledWith(2);
  });

  it("no hace GET de producto por cada línea", () => {
    renderConProvider(<V2NextProductsStep {...PROPS} />);

    const rutas = globalFetchSpy.mock.calls.map(([input]) => String(input));
    expect(rutas.some((url) => /\/products\/\d+/.test(url))).toBe(false);
  });
});
