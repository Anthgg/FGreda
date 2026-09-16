import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { V2NextProductsStep } from "./V2NextProductsStep";
import { V2NextWizard } from "../V2NextWizard";

// Mocks
vi.mock("@/features/cotizadorV2/useQuoterV2Materials", () => ({
  useV2QuotationProducts: vi.fn(),
  useAddV2QuotationProduct: vi.fn(),
  useUpdateV2QuotationProduct: vi.fn(),
  useDeleteV2QuotationProduct: vi.fn(),
}));

vi.mock("@/features/cotizadorV2/useQuoterV2", () => ({
  useV2Quotation: vi.fn(),
  useUpdateV2Quotation: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock("@/features/cotizadorV2/useEstadoDeGuardado", () => ({
  useEstadoDeGuardado: vi.fn(),
}));

vi.mock("@/api/masters", () => ({
  fetchProduct: vi.fn(),
  fetchProducts: vi.fn(),
}));

import { useV2QuotationProducts, useAddV2QuotationProduct, useUpdateV2QuotationProduct, useDeleteV2QuotationProduct } from "@/features/cotizadorV2/useQuoterV2Materials";
import { useV2Quotation } from "@/features/cotizadorV2/useQuoterV2";
import { useEstadoDeGuardado } from "@/features/cotizadorV2/useEstadoDeGuardado";
import { fetchProduct, fetchProducts } from "@/api/masters";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderStep(quotationId: number, step = 2) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/cotizador-v2-next/${quotationId}/${step}`]}>
        <Routes>
          <Route path="/cotizador-v2-next/:quotationId/:step" element={<V2NextWizard quotationId={quotationId} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("V2NextProductsStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useV2Quotation as any).mockReturnValue({
      isPending: false,
      isError: false,
      data: { id: 1, name: "Test Quotation", status: "DRAFT", effective_status: "DRAFT" },
    });

    (useEstadoDeGuardado as any).mockReturnValue({
      hayRiesgo: false,
      enVuelo: 0,
      fallidos: [],
      borradores: 0,
    });

    (fetchProducts as any).mockResolvedValue({
      items: [{ id: 101, name: "Taza mock", internal_reference: "TAZ101", product_type: "RETAIL" }],
      total: 1,
    });

    (fetchProduct as any).mockResolvedValue({
      id: 101,
      name: "Taza mock",
      internal_reference: "TAZ101",
      length: "12.0",
      width: "12.0",
      height: "18.0",
    });
  });

  it("muestra empty state cuando no hay productos", async () => {
    (useV2QuotationProducts as any).mockReturnValue({
      isPending: false,
      isError: false,
      data: { items: [] },
    });
    (useAddV2QuotationProduct as any).mockReturnValue({ mutate: vi.fn() });

    renderStep(1);

    expect(await screen.findByText(/Todavía no hay productos/i)).toBeInTheDocument();
    const btn = screen.getAllByRole("button", { name: /\+ Agregar producto/i })[0];
    expect(btn).toBeInTheDocument();
  });

  it("abre modal de selección y permite agregar producto", async () => {
    (useV2QuotationProducts as any).mockReturnValue({
      isPending: false,
      isError: false,
      data: { items: [] },
    });
    const addMutate = vi.fn();
    (useAddV2QuotationProduct as any).mockReturnValue({ mutate: addMutate });

    renderStep(1);

    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: /\+ Agregar producto/i })[0]);

    // Modal is open, now we need to open the ProductSelectField dropdown
    const selectTrigger = await screen.findByText(/Ej: Jarra, Taza/i);
    await user.click(selectTrigger);

    // Now the search input should be visible
    const searchInput = await screen.findByPlaceholderText(/Buscar por código o nombre/i);
    await user.type(searchInput, "Taza");

    // Click result
    const option = await screen.findByText(/Taza mock/i);
    await user.click(option);

    // It should have called mutate with product_id
    expect(addMutate).toHaveBeenCalledWith(
      expect.objectContaining({ product_id: 101, quantity: 1 }),
      expect.any(Object)
    );
  });

  it("muestra productos con read-only dimensiones si el maestro las tiene", async () => {
    (useV2QuotationProducts as any).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        items: [
          {
            id: 10,
            product_id: 101,
            product_name: "Taza mock",
            quantity: 5,
            length_cm: "12.0",
            width_cm: "12.0",
            height_cm: "18.0",
            unit_volume_cm3: "100",
            total_volume_cm3: "500",
            client_observation: "",
          }
        ]
      },
    });
    (useAddV2QuotationProduct as any).mockReturnValue({ mutate: vi.fn() });
    (useUpdateV2QuotationProduct as any).mockReturnValue({ mutate: vi.fn() });
    (useDeleteV2QuotationProduct as any).mockReturnValue({ mutate: vi.fn() });

    renderStep(1);

    // Quantity should be a textbox (from DecimalField)
    expect(await screen.findByLabelText(/Cantidad \*/i)).toHaveValue("5");

    // Dimensions should be read-only text, not inputs
    expect(screen.queryByLabelText(/Largo \(cm\)/i)).not.toBeInTheDocument();
    // In jsdom &times; might just be rendered literally or as 'x' depending on encoding, so we check partly
    expect(await screen.findByText(/12\.0.*12\.0.*18\.0 cm/i)).toBeInTheDocument();
  });

  it("habilita campos de dimensiones si el maestro no las tiene", async () => {
    // Override product fetch to have no dimensions
    (fetchProduct as any).mockResolvedValue({
      id: 101,
      name: "Taza mock",
      internal_reference: "TAZ101",
      length: null,
      width: null,
      height: null,
    });

    (useV2QuotationProducts as any).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        items: [
          {
            id: 10,
            product_id: 101,
            product_name: "Taza mock",
            quantity: 5,
            length_cm: "0",
            width_cm: "0",
            height_cm: "0",
            unit_volume_cm3: "0",
            total_volume_cm3: "0",
            client_observation: "",
          }
        ]
      },
    });
    (useAddV2QuotationProduct as any).mockReturnValue({ mutate: vi.fn() });
    (useUpdateV2QuotationProduct as any).mockReturnValue({ mutate: vi.fn() });
    (useDeleteV2QuotationProduct as any).mockReturnValue({ mutate: vi.fn() });

    renderStep(1);

    // Should render dimension inputs
    expect(await screen.findByLabelText(/Largo \(cm\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ancho \(cm\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Alto \(cm\)/i)).toBeInTheDocument();
  });

  it("read-only si la cotización no es DRAFT", async () => {
    (useV2Quotation as any).mockReturnValue({
      isPending: false,
      isError: false,
      data: { id: 1, name: "Test Quotation", status: "CONFIRMED", effective_status: "CONFIRMED" },
    });

    (fetchProduct as any).mockResolvedValue({
      id: 101,
      name: "Taza mock",
      internal_reference: "TAZ101",
      length: null,
      width: null,
      height: null,
    });

    (useV2QuotationProducts as any).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        items: [
          {
            id: 10,
            product_id: 101,
            product_name: "Taza mock",
            quantity: 5,
            length_cm: "0",
            width_cm: "0",
            height_cm: "0",
            unit_volume_cm3: "0",
            total_volume_cm3: "0",
            client_observation: "",
          }
        ]
      },
    });
    (useAddV2QuotationProduct as any).mockReturnValue({ mutate: vi.fn() });
    (useUpdateV2QuotationProduct as any).mockReturnValue({ mutate: vi.fn() });
    (useDeleteV2QuotationProduct as any).mockReturnValue({ mutate: vi.fn() });

    renderStep(1);

    // Botón agregar producto no debe estar
    expect(screen.queryByRole("button", { name: /\+ Agregar producto/i })).not.toBeInTheDocument();

    // Campos disabled
    const qty = await screen.findByLabelText(/Cantidad \*/i);
    expect(qty).toBeDisabled();

    const largo = screen.getByLabelText(/Largo \(cm\)/i);
    expect(largo).toBeDisabled();
  });

  it("espera guardado antes de continuar", async () => {
    (useV2QuotationProducts as any).mockReturnValue({
      isPending: false,
      isError: false,
      data: { items: [] },
    });
    (useAddV2QuotationProduct as any).mockReturnValue({ mutate: vi.fn() });

    // Simulate dirty state
    (useEstadoDeGuardado as any).mockReturnValue({
      hayRiesgo: true,
      enVuelo: 1, // simulates pending mutation
      fallidos: [],
      borradores: 0,
    });

    renderStep(1, 1); // Render client step initially

    // Since enVuelo > 0, the "Continuar" button should be disabled
    // Or it shouldn't navigate if clicked. Actually we made it disabled if enVuelo > 0? No, "Guardar borrador" is disabled if enVuelo > 0.
    // "Continuar" is disabled if pendingStep !== null or fallidos.length > 0.
    // But handleStep checks `hayRiesgo`. If hayRiesgo, it sets pendingStep.
    
    const user = userEvent.setup();
    const continuarBtn = await screen.findByRole("button", { name: /Continuar/i });
    await user.click(continuarBtn);

    // Button should now say "Guardando..."
    expect(screen.getByRole("button", { name: /Guardando/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardando/i })).toBeDisabled();
  });
});
