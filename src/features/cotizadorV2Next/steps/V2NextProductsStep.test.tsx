import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { V2NextProductsStep } from "./V2NextProductsStep";
import { COTIZACION } from "@/test/v2next/shellFixtures";
import { CUSTOM_PIECE, CATALOG_PIECE } from "@/test/v2next/productsFixtures";
import { vaciarRegistroDeBorradores } from "@/components/borradores";
import { jsonResponse } from "@/test/utils";
import type { V2QuotationProduct } from "@/types/quoterV2Materials";

const hooks = {
  productsQuery: { data: { items: [CATALOG_PIECE, CUSTOM_PIECE] as V2QuotationProduct[], materials_cost: "0" }, isPending: false },
  actualizar: { mutate: vi.fn() },
  borrar: { mutate: vi.fn() },
  anadir: { mutate: vi.fn((_vars, options) => {
      if (options?.onSuccess) options.onSuccess();
  }) },
  esperar: vi.fn((_mut, _key, vars: unknown) => {
    hooks.actualizar.mutate(vars);
    return Promise.resolve();
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
  datos: { cotizacion: COTIZACION } as unknown,
  estados: [],
  irAPaso: () => {},
};

function renderConProvider(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("V2NextProductsStep", () => {
  let globalFetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vaciarRegistroDeBorradores();
    hooks.productsQuery.data = { items: [CATALOG_PIECE, CUSTOM_PIECE], materials_cost: "0" };
    globalFetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, { items: [] }));
    vi.stubGlobal("fetch", globalFetchSpy);
  });

  it("renderiza lineas correctamente", () => {
    renderConProvider(<V2NextProductsStep {...PROPS} />);
    expect(screen.getByText("Plato hondo")).toBeInTheDocument();
    expect(screen.getByText("Taza personalizada")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("20.0").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("5.0")).toBeInTheDocument();
    expect(screen.queryByText(/S\//)).not.toBeInTheDocument();
  });

  it("sin canEdit muestra lista descriptiva sin inputs", () => {
    renderConProvider(<V2NextProductsStep {...PROPS} canEdit={false} />);
    expect(screen.queryByLabelText("Cantidad")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Largo")).not.toBeInTheDocument();
    expect(screen.getByText(/20.0 L/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
  });

  it("permite agregar de catalogo con un PUT correcto", async () => {
    hooks.productsQuery.data = { items: [], materials_cost: "0" };
    const user = userEvent.setup();
    globalFetchSpy.mockResolvedValueOnce(jsonResponse(200, { items: [{ id: 101, name: "Plato Nuevo", type: "FINISHED_PRODUCT" }] }));

    renderConProvider(<V2NextProductsStep {...PROPS} />);
    await user.click(screen.getByRole("button", { name: "Agregar pieza" }));
    
    await user.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText("Busca o escribe el nombre...");
    await user.type(input, "Plato");
    
    const option = await screen.findByText("Plato Nuevo");
    await user.click(option);

    expect(hooks.anadir.mutate).toHaveBeenCalledWith(
      { product_id: 101, quantity: 1 },
      expect.any(Object)
    );
  });

  it("permite agregar a medida", async () => {
    hooks.productsQuery.data = { items: [], materials_cost: "0" };
    const user = userEvent.setup();

    renderConProvider(<V2NextProductsStep {...PROPS} />);
    await user.click(screen.getByRole("button", { name: "Agregar pieza" }));
    
    await user.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText("Busca o escribe el nombre...");
    await user.type(input, "Nueva cosa");
    
    const createOption = await screen.findByText("Pieza a medida «Nueva cosa»");
    await user.click(createOption);

    expect(hooks.anadir.mutate).toHaveBeenCalledWith(
      { product_name: "Nueva cosa", quantity: 1 },
      expect.any(Object)
    );
  });

  it("cantidad por stepper hace 1 PUT tras pausa", async () => {
    const user = userEvent.setup();
    renderConProvider(<V2NextProductsStep {...PROPS} />);
    
    const btnPlusList = screen.getAllByRole("button", { name: "Más" });
    const btnPlus = btnPlusList[0] as HTMLElement;
    
    await user.click(btnPlus);
    await user.click(btnPlus);
    await user.click(btnPlus);
    await user.click(btnPlus);
    await user.click(btnPlus);
    
    expect(hooks.esperar).not.toHaveBeenCalled();
    
    await waitFor(() => {
      expect(hooks.esperar).toHaveBeenCalledTimes(1);
    }, { timeout: 1000 });
    
    expect(hooks.actualizar.mutate).toHaveBeenCalledWith({
      lineId: 2,
      payload: { quantity: 6 },
    });
  });

  it("cantidad tecleada guarda al salir", async () => {
    const user = userEvent.setup();
    renderConProvider(<V2NextProductsStep {...PROPS} />);
    
    const inputs = screen.getAllByLabelText("Cantidad");
    const quantityInput = inputs[1] as HTMLElement;
    
    await user.click(quantityInput);
    await user.keyboard("{Backspace}{Backspace}10");
    await user.tab();
    
    expect(hooks.esperar).toHaveBeenCalled();
    expect(hooks.actualizar.mutate).toHaveBeenCalledWith({
      lineId: 1,
      payload: { quantity: 10 },
    });
  });

  it("medidas editables en pieza de catalogo mandan null si se vacia", async () => {
    const user = userEvent.setup();
    renderConProvider(<V2NextProductsStep {...PROPS} />);
    
    const inputsLargo = screen.getAllByRole("textbox", { name: /largo/i });
    const largoCat = inputsLargo[0] as HTMLElement;
    
    await user.clear(largoCat);
    await user.tab();
    
    expect(hooks.esperar).toHaveBeenCalled();
    expect(hooks.actualizar.mutate).toHaveBeenCalledWith({
      lineId: 2,
      payload: { length_cm: null },
    });
  });

  it("observacion al cliente", async () => {
    const user = userEvent.setup();
    renderConProvider(<V2NextProductsStep {...PROPS} />);
    
    const obsInputs = screen.getAllByRole("textbox", { name: /nota/i });
    const obsCustom = obsInputs[1] as HTMLElement;
    
    await user.clear(obsCustom);
    await user.type(obsCustom, "Nueva nota");
    await user.tab();
    
    expect(hooks.esperar).toHaveBeenCalled();
    expect(hooks.actualizar.mutate).toHaveBeenCalledWith({
      lineId: 1,
      payload: { client_observation: "Nueva nota" },
    });
  });

  it("borrar abre portal al body", async () => {
    const user = userEvent.setup();
    renderConProvider(<V2NextProductsStep {...PROPS} />);
    
    const quitarBtns = screen.getAllByRole("button", { name: "Quitar" });
    await user.click(quitarBtns[0] as HTMLElement);
    
    const dialog = screen.getByRole("dialog", { name: "¿Quitar pieza?" });
    expect(dialog).toBeInTheDocument();
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    
    const confirmBtn = screen.getByRole("button", { name: "Quitar", hidden: true });
    await user.click(confirmBtn);
    
    expect(hooks.borrar.mutate).toHaveBeenCalledWith(2);
  });
});
