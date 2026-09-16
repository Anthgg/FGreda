import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { V2NextWizard } from "../V2NextWizard";

// ── Mocks ──────────────────────────────────────────────────────────────────────

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

// Import mocked modules - use type imports for type-only use
import {
  useV2QuotationProducts,
  useAddV2QuotationProduct,
  useUpdateV2QuotationProduct,
  useDeleteV2QuotationProduct,
} from "@/features/cotizadorV2/useQuoterV2Materials";
import { useV2Quotation } from "@/features/cotizadorV2/useQuoterV2";
import { useEstadoDeGuardado } from "@/features/cotizadorV2/useEstadoDeGuardado";
import { fetchProduct, fetchProducts } from "@/api/masters";

// We use vi.mocked to get typed mock references. The actual return values are
// cast via `as unknown as` to avoid the partial-mock double-comparison TS error
// that occurs when you try to satisfy the full TanStack Query union types.
const mockProducts = vi.mocked(useV2QuotationProducts);
const mockAdd = vi.mocked(useAddV2QuotationProduct);
const mockUpdate = vi.mocked(useUpdateV2QuotationProduct);
const mockDelete = vi.mocked(useDeleteV2QuotationProduct);
const mockQuotation = vi.mocked(useV2Quotation);
const mockGuardado = vi.mocked(useEstadoDeGuardado);
const mockFetchProducts = vi.mocked(fetchProducts);
const mockFetchProduct = vi.mocked(fetchProduct);

// ── Fixtures ───────────────────────────────────────────────────────────────────

const DRAFT_Q = {
  id: 1,
  name: "Test Quotation",
  code: "COT-001",
  status: "DRAFT" as const,
  effective_status: "DRAFT",
  production_type: "RETAIL" as const,
  currency_code: "PEN",
  currency_symbol: "S/",
  customer_id: null,
  customer_name: null,
  notes: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = (data: unknown) => ({ isPending: false, isError: false, data } as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const m = (mutate: unknown = vi.fn()) => ({ mutate } as any);

function renderStep(step = 2) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/cotizador-v2-next/1/${step}`]}>
        <Routes>
          <Route
            path="/cotizador-v2-next/:quotationId/:step"
            element={<V2NextWizard quotationId={1} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────────

describe("V2NextProductsStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockQuotation.mockReturnValue(q(DRAFT_Q));
    mockGuardado.mockReturnValue(q({ hayRiesgo: false, enVuelo: 0, fallidos: [], borradores: 0, descartar: vi.fn() }).data);
    mockFetchProducts.mockResolvedValue({ items: [{ id: 101, name: "Taza mock", internal_reference: "TAZ101", product_type: "RETAIL" }], total: 1, limit: 20, offset: 0 } as unknown as Awaited<ReturnType<typeof fetchProducts>>);
    mockFetchProduct.mockResolvedValue({ id: 101, name: "Taza mock", internal_reference: "TAZ101", length: "12.0", width: "12.0", height: "18.0" } as Awaited<ReturnType<typeof fetchProduct>>);
  });

  it("muestra empty state cuando no hay productos", async () => {
    mockProducts.mockReturnValue(q({ items: [], total: 0 }));
    mockAdd.mockReturnValue(m());

    renderStep(2);

    expect(await screen.findByText(/Todavía no hay productos/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /\+ Agregar producto/i })[0]).toBeInTheDocument();
  });

  it("abre modal de selección y permite agregar producto", async () => {
    mockProducts.mockReturnValue(q({ items: [], total: 0 }));
    const addMutate = vi.fn();
    mockAdd.mockReturnValue(m(addMutate));

    renderStep(2);

    const user = userEvent.setup();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await user.click(screen.getAllByRole("button", { name: /\+ Agregar producto/i })[0]!);

    const selectTrigger = await screen.findByText(/Ej: Jarra, Taza/i);
    await user.click(selectTrigger);

    const searchInput = await screen.findByPlaceholderText(/Buscar por código o nombre/i);
    await user.type(searchInput, "Taza");

    const option = await screen.findByText(/Taza mock/i);
    await user.click(option);

    expect(addMutate).toHaveBeenCalledWith(
      expect.objectContaining({ product_id: 101, quantity: 1 }),
      expect.any(Object)
    );
  });

  it("muestra productos con read-only dimensiones si el maestro las tiene", async () => {
    mockProducts.mockReturnValue(q({
      items: [{
        id: 10, product_id: 101, product_name: "Taza mock", quantity: 5,
        length_cm: "12.0", width_cm: "12.0", height_cm: "18.0",
        unit_volume_cm3: "100", total_volume_cm3: "500", client_observation: "",
      }],
      total: 1,
    }));
    mockAdd.mockReturnValue(m());
    mockUpdate.mockReturnValue(m());
    mockDelete.mockReturnValue(m());

    renderStep(2);

    expect(await screen.findByLabelText(/Cantidad \*/i)).toHaveValue("5");
    expect(screen.queryByLabelText(/Largo \(cm\)/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/12\.0.*12\.0.*18\.0 cm/i)).toBeInTheDocument();
  });

  it("habilita campos de dimensiones si el maestro no las tiene", async () => {
    mockFetchProduct.mockResolvedValue({ id: 101, name: "Taza mock", internal_reference: "TAZ101", length: null, width: null, height: null } as Awaited<ReturnType<typeof fetchProduct>>);
    mockProducts.mockReturnValue(q({
      items: [{
        id: 10, product_id: 101, product_name: "Taza mock", quantity: 5,
        length_cm: "0", width_cm: "0", height_cm: "0",
        unit_volume_cm3: "0", total_volume_cm3: "0", client_observation: "",
      }],
      total: 1,
    }));
    mockAdd.mockReturnValue(m());
    mockUpdate.mockReturnValue(m());
    mockDelete.mockReturnValue(m());

    renderStep(2);

    expect(await screen.findByLabelText(/Largo \(cm\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ancho \(cm\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Alto \(cm\)/i)).toBeInTheDocument();
  });

  it("read-only si la cotización no es DRAFT", async () => {
    mockQuotation.mockReturnValue(q({ ...DRAFT_Q, status: "CONFIRMED", effective_status: "CONFIRMED" }));
    mockFetchProduct.mockResolvedValue({ id: 101, name: "Taza mock", internal_reference: "TAZ101", length: null, width: null, height: null } as Awaited<ReturnType<typeof fetchProduct>>);
    mockProducts.mockReturnValue(q({
      items: [{
        id: 10, product_id: 101, product_name: "Taza mock", quantity: 5,
        length_cm: "0", width_cm: "0", height_cm: "0",
        unit_volume_cm3: "0", total_volume_cm3: "0", client_observation: "",
      }],
      total: 1,
    }));
    mockAdd.mockReturnValue(m());
    mockUpdate.mockReturnValue(m());
    mockDelete.mockReturnValue(m());

    renderStep(2);

    expect(screen.queryByRole("button", { name: /\+ Agregar producto/i })).not.toBeInTheDocument();
    expect(await screen.findByLabelText(/Cantidad \*/i)).toBeDisabled();
    // Dimension inputs appear once fetchProduct resolves (async useQuery)
    expect(await screen.findByLabelText(/Largo \(cm\)/i)).toBeDisabled();
  });

  it("espera guardado antes de continuar", async () => {
    mockProducts.mockReturnValue(q({ items: [], total: 0 }));
    mockAdd.mockReturnValue(m());
    mockGuardado.mockReturnValue({ hayRiesgo: true, enVuelo: 1, fallidos: [], borradores: 0, descartar: vi.fn() } as ReturnType<typeof useEstadoDeGuardado>);

    renderStep(1);

    const user = userEvent.setup();
    const continuarBtn = await screen.findByRole("button", { name: /Continuar/i });
    await user.click(continuarBtn);

    expect(screen.getByRole("button", { name: /Guardando/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardando/i })).toBeDisabled();
  });
});
