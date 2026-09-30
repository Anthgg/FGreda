import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { V2NextMaterialsStep } from "@/features/cotizadorV2Next/steps/V2NextMaterialsStep";
import { formatCosto } from "@/features/cotizadorV2/moneda";
import {
  BODY_MATERIALS,
  COTIZACION_MATERIALES,
  GLAZE_MATERIALS,
  LINEA_MATERIALES,
  crearLineaMateriales,
  crearPaginaMateriales,
} from "@/test/v2next/materialsFixtures";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";
import type { V2Material, V2QuotationProductsPage } from "@/types/quoterV2Materials";

const hooks = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  esperar: vi.fn(),
  productsQuery: undefined as unknown,
  bodyQuery: undefined as unknown,
  glazeQuery: undefined as unknown,
}));

vi.mock("@/features/cotizadorV2/useQuoterV2Materials", () => ({
  useV2QuotationProducts: vi.fn(() => hooks.productsQuery),
  useV2Materials: vi.fn((kind: string) => (kind === "BODY" ? hooks.bodyQuery : hooks.glazeQuery)),
  useUpdateV2QuotationProduct: vi.fn(() => ({
    mutate: hooks.mutate,
    mutateAsync: hooks.mutateAsync,
    isError: false,
    error: null,
  })),
}));

vi.mock("@/features/cotizadorV2/claves", () => ({
  useEsperarGuardado: vi.fn(() => hooks.esperar),
}));

function consultaOk<T>(data: T) {
  return { data, isPending: false, isError: false, error: null };
}

function prepararConsultas(pagina: V2QuotationProductsPage = crearPaginaMateriales()) {
  hooks.productsQuery = consultaOk(pagina);
  hooks.bodyQuery = consultaOk<{ items: V2Material[] }>({ items: BODY_MATERIALS });
  hooks.glazeQuery = consultaOk<{ items: V2Material[] }>({ items: GLAZE_MATERIALS });
}

function renderPaso(opciones: {
  canEdit?: boolean;
  irAPaso?: PasoDelAsistenteProps["irAPaso"];
  cotizacion?: PasoDelAsistenteProps["datos"]["cotizacion"];
} = {}) {
  const irAPaso = opciones.irAPaso ?? vi.fn();
  const props: PasoDelAsistenteProps = {
    quotationId: 7,
    canEdit: opciones.canEdit ?? true,
    datos: {
      cotizacion: opciones.cotizacion ?? COTIZACION_MATERIALES,
      productos: undefined,
      manoDeObra: undefined,
      quema: undefined,
      precio: undefined,
    },
    estados: [],
    irAPaso,
  };
  return { ...render(<V2NextMaterialsStep {...props} />), irAPaso };
}

async function elegir(user: ReturnType<typeof userEvent.setup>, campo: string, opcion: RegExp) {
  await user.click(screen.getByRole("combobox", { name: campo }));
  await user.click(await screen.findByRole("option", { name: opcion }));
}

describe("V2NextMaterialsStep", () => {
  beforeEach(() => {
    hooks.mutate.mockReset();
    hooks.mutateAsync.mockReset();
    hooks.esperar.mockReset();
    hooks.esperar.mockResolvedValue({ ok: true, firma: "linea-editar", fresco: false });
    prepararConsultas();
  });

  it("manda el payload exacto al elegir arcilla y al dejarla sin arcilla", async () => {
    const user = userEvent.setup();
    renderPaso();

    await elegir(user, "Arcilla", /Arcilla Blanca/);
    expect(hooks.mutate).toHaveBeenLastCalledWith({
      lineId: LINEA_MATERIALES.id,
      payload: { body_material_id: 4 },
    });

    await elegir(user, "Arcilla", /^Sin arcilla$/);
    expect(hooks.mutate).toHaveBeenLastCalledWith({
      lineId: LINEA_MATERIALES.id,
      payload: { body_material_id: null },
    });
  });

  it.each([
    ["450", "450"],
    ["450,5", "450.5"],
  ])("guarda la arcilla por pieza al salir del campo: %s", async (entrada, canonico) => {
    const user = userEvent.setup();
    renderPaso();

    const peso = screen.getByRole("textbox", { name: /Arcilla por pieza/ });
    await user.clear(peso);
    await user.type(peso, entrada);

    expect(hooks.esperar).not.toHaveBeenCalled();

    await user.tab();
    await waitFor(() => expect(hooks.esperar).toHaveBeenCalled());
    expect(hooks.esperar).toHaveBeenLastCalledWith(expect.any(Object), "linea-editar", {
      lineId: LINEA_MATERIALES.id,
      payload: { body_unit_weight: canonico },
    });
  });

  it("manda el payload exacto al prender y apagar esmalte", async () => {
    const user = userEvent.setup();
    prepararConsultas(
      crearPaginaMateriales([crearLineaMateriales({ requires_glaze: false })]),
    );
    const vistaSinEsmalte = renderPaso();

    await user.click(screen.getByRole("switch", { name: /Lleva esmalte/ }));
    expect(hooks.mutate).toHaveBeenLastCalledWith({
      lineId: LINEA_MATERIALES.id,
      payload: { requires_glaze: true },
    });

    vistaSinEsmalte.unmount();
    hooks.mutate.mockClear();
    prepararConsultas(
      crearPaginaMateriales([crearLineaMateriales({ requires_glaze: true })]),
    );
    renderPaso();

    await user.click(screen.getByRole("switch", { name: /Lleva esmalte/ }));
    expect(hooks.mutate).toHaveBeenLastCalledWith({
      lineId: LINEA_MATERIALES.id,
      payload: { requires_glaze: false },
    });
  });

  it("manda null para esmalte automático y el id para esmalte elegido", async () => {
    const user = userEvent.setup();
    prepararConsultas(
      crearPaginaMateriales([
        crearLineaMateriales({
          glaze_material_id: 9,
          glaze_material_name: "Esmalte Transparente",
          glaze_is_reference: false,
        }),
      ]),
    );
    const vistaElegida = renderPaso();

    await elegir(user, "Esmalte", /Automático/);
    expect(hooks.mutate).toHaveBeenLastCalledWith({
      lineId: LINEA_MATERIALES.id,
      payload: { glaze_material_id: null },
    });

    vistaElegida.unmount();
    hooks.mutate.mockClear();
    prepararConsultas();
    renderPaso();

    await elegir(user, "Esmalte", /Esmalte Azul/);
    expect(hooks.mutate).toHaveBeenLastCalledWith({
      lineId: LINEA_MATERIALES.id,
      payload: { glaze_material_id: 10 },
    });
  });

  it("no crea campos para gramos de esmalte ni para proporción", () => {
    renderPaso();

    expect(screen.queryByLabelText(/esmalte por pieza/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/gramos de esmalte/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /proporción/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: /proporción/i })).not.toBeInTheDocument();
    expect(screen.getByText("Proporción")).toBeInTheDocument();
  });

  it("dice referencia y avisos en palabras, sin enseñar códigos crudos", () => {
    prepararConsultas(
      crearPaginaMateriales([
        crearLineaMateriales({
          warnings: ["V2_GLAZE_REFERENCE_WITHOUT_STOCK", "V2_WARNING_NUEVO"],
        }),
      ]),
    );

    renderPaso();

    expect(screen.getByText("Referencia de costeo")).toBeInTheDocument();
    expect(screen.getByText(/no el esmalte final/i)).toBeInTheDocument();
    expect(screen.getByText(/El esmalte usado como referencia no tiene stock/i)).toBeInTheDocument();
    expect(screen.getByText("Hay un aviso de materiales para esta pieza.")).toBeInTheDocument();
    expect(screen.queryByText(/V2_/)).not.toBeInTheDocument();
  });

  it("mantiene los costos en soles aunque la cotización esté en USD", () => {
    renderPaso({
      cotizacion: {
        ...COTIZACION_MATERIALES,
        currency_code: "USD",
        currency_symbol: "US$",
      },
    });

    expect(screen.getByTestId("materials-total")).toHaveTextContent("S/");
    expect(screen.getByText(formatCosto(LINEA_MATERIALES.materials_cost))).toBeInTheDocument();
  });

  it("en solo lectura muestra valores, no controles deshabilitados", () => {
    renderPaso({ canEdit: false });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Arcilla Terranova")).toBeInTheDocument();
    expect(screen.getByText("300.00 g")).toBeInTheDocument();
    expect(screen.getAllByText("Esmalte Transparente")).toHaveLength(2);
  });

  it("si no hay líneas lleva al paso productos", async () => {
    const user = userEvent.setup();
    const irAPaso = vi.fn();
    prepararConsultas(crearPaginaMateriales([]));
    renderPaso({ irAPaso });

    await user.click(screen.getByRole("button", { name: "Ir a Piezas" }));
    expect(irAPaso).toHaveBeenCalledWith("productos");
  });
});
