/**
 * V2NextClientStep.test.tsx
 *
 * Verifica que el Paso 1 — Cliente use SelectField (role="combobox")
 * en lugar de <select> nativo para Tipo de producción y Moneda.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { V2NextWizard } from "../V2NextWizard";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/features/cotizadorV2/useQuoterV2", () => ({
  useV2Quotation: vi.fn(),
  useUpdateV2Quotation: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock("@/features/cotizadorV2/useEstadoDeGuardado", () => ({
  useEstadoDeGuardado: vi.fn(),
}));

// Productos step no se activa en estos tests (step=1), pero sus hooks se
// importan en el árbol. Los mockeamos para que no exploten.
vi.mock("@/features/cotizadorV2/useQuoterV2Materials", () => ({
  useV2QuotationProducts: vi.fn(),
  useAddV2QuotationProduct: vi.fn(),
  useUpdateV2QuotationProduct: vi.fn(),
  useDeleteV2QuotationProduct: vi.fn(),
}));

vi.mock("@/api/masters", () => ({
  fetchProduct: vi.fn(),
  fetchProducts: vi.fn(),
}));

import { useV2Quotation, useUpdateV2Quotation } from "@/features/cotizadorV2/useQuoterV2";
import { useEstadoDeGuardado } from "@/features/cotizadorV2/useEstadoDeGuardado";

const mockUseV2Quotation = vi.mocked(useV2Quotation);
const mockUseEstadoDeGuardado = vi.mocked(useEstadoDeGuardado);

// Helper: mock de mutación — el cast a unknown es necesario porque los tipos de
// TanStack Query son union muy amplios y no aceptan parciales directamente.
const m = (mutate = vi.fn()) => ({ mutate } as unknown as ReturnType<typeof useUpdateV2Quotation>);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = (data: unknown) => ({ isPending: false, isError: false, data } as any);

// ── Fixtures ───────────────────────────────────────────────────────────────────

const DRAFT_Q = {
  id: 1,
  name: "Prueba cotización",
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderClientStep() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/cotizador-v2-next/1/1"]}>
        <Routes>
          <Route
            path="/cotizador-v2-next/:quotationId/:step"
            element={<V2NextWizard quotationId={1} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { container };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("V2NextClientStep — SelectField (no <select> nativo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseV2Quotation.mockReturnValue(q(DRAFT_Q));
    mockUseEstadoDeGuardado.mockReturnValue({
      hayRiesgo: false,
      enVuelo: 0,
      fallidos: [],
      borradores: 0,
      descartar: vi.fn(),
    } as ReturnType<typeof useEstadoDeGuardado>);
    vi.mocked(useUpdateV2Quotation).mockReturnValue(m());
  });

  // ── Auditoría: NO debe existir ningún <select> nativo ──────────────────────

  it("NO existe ningún <select> nativo en el DOM", async () => {
    const { container } = renderClientStep();
    await screen.findByText(/Tipo de producción/i);
    expect(container.querySelector("select")).toBeNull();
  });

  // ── Tipo de producción ─────────────────────────────────────────────────────

  it("Tipo de producción renderiza role='combobox'", async () => {
    renderClientStep();
    const comboboxes = await screen.findAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(1);
  });

  it("abrir Tipo de producción muestra opciones Por menor y Por mayor", async () => {
    renderClientStep();
    const user = userEvent.setup();

    const tipoBtn = await screen.findByRole("combobox", { name: /Tipo de producción/i });
    await user.click(tipoBtn);

    expect(await screen.findByRole("option", { name: /Por menor/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Por mayor/i })).toBeInTheDocument();
  });

  it("seleccionar Por mayor llama mutate con WHOLESALE", async () => {
    const mutate = vi.fn();
    vi.mocked(useUpdateV2Quotation).mockReturnValue(m(mutate));

    renderClientStep();
    const user = userEvent.setup();

    const tipoBtn = await screen.findByRole("combobox", { name: /Tipo de producción/i });
    await user.click(tipoBtn);

    const opcionMayor = await screen.findByRole("option", { name: /Por mayor/i });
    await user.click(opcionMayor);

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ production_type: "WHOLESALE" })
    );
  });

  // ── Moneda ─────────────────────────────────────────────────────────────────

  it("Moneda renderiza role='combobox'", async () => {
    renderClientStep();
    const comboboxes = await screen.findAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
  });

  it("abrir Moneda muestra PEN y USD", async () => {
    renderClientStep();
    const user = userEvent.setup();

    const monedaBtn = await screen.findByRole("combobox", { name: /Moneda/i });
    await user.click(monedaBtn);

    expect(await screen.findByRole("option", { name: /Soles \(PEN\)/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Dólares \(USD\)/i })).toBeInTheDocument();
  });

  it("seleccionar USD llama mutate con 'USD'", async () => {
    const mutate = vi.fn();
    vi.mocked(useUpdateV2Quotation).mockReturnValue(m(mutate));

    renderClientStep();
    const user = userEvent.setup();

    const monedaBtn = await screen.findByRole("combobox", { name: /Moneda/i });
    await user.click(monedaBtn);

    const opcionUSD = await screen.findByRole("option", { name: /Dólares \(USD\)/i });
    await user.click(opcionUSD);

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ currency_code: "USD" })
    );
  });

  // ── Navegación por teclado ─────────────────────────────────────────────────

  it("navegación por teclado funciona (ArrowDown + Enter selecciona Por mayor)", async () => {
    const mutate = vi.fn();
    vi.mocked(useUpdateV2Quotation).mockReturnValue(m(mutate));

    renderClientStep();
    const user = userEvent.setup();

    const tipoBtn = await screen.findByRole("combobox", { name: /Tipo de producción/i });
    await user.click(tipoBtn);

    // Dropdown opens with "RETAIL" highlighted (index 0). ArrowDown moves to WHOLESALE.
    await user.keyboard("{ArrowDown}{Enter}");

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ production_type: "WHOLESALE" })
    );
  });

  it("Escape cierra el dropdown de Tipo de producción", async () => {
    renderClientStep();
    const user = userEvent.setup();

    const tipoBtn = await screen.findByRole("combobox", { name: /Tipo de producción/i });
    await user.click(tipoBtn);

    expect(await screen.findByRole("option", { name: /Por menor/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("option", { name: /Por menor/i })).not.toBeInTheDocument();
  });

  // ── searchable={false}: NO debe mostrar buscador para 2 opciones ───────────

  it("no muestra buscador para Tipo de producción (searchable=false, 2 opciones)", async () => {
    renderClientStep();
    const user = userEvent.setup();

    const tipoBtn = await screen.findByRole("combobox", { name: /Tipo de producción/i });
    await user.click(tipoBtn);

    // SelectField shows search only when options.length > 2 or allowCreate.
    // With 2 options and searchable=false, showSearch = false → no input.
    const listbox = screen.getByRole("listbox");
    expect(listbox.querySelector("input")).toBeNull();
  });

  it("no muestra buscador para Moneda (searchable=false, 2 opciones)", async () => {
    renderClientStep();
    const user = userEvent.setup();

    const monedaBtn = await screen.findByRole("combobox", { name: /Moneda/i });
    await user.click(monedaBtn);

    const listbox = screen.getByRole("listbox");
    expect(listbox.querySelector("input")).toBeNull();
  });
});
