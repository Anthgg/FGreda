import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CotizadorV2NextPage } from "./CotizadorV2NextPage";

// Mock API responses
vi.mock("@/api/client", () => ({
  apiClient: {
    get: vi.fn((url) => {
      if (url.includes("/quotations-v2/123")) {
        return Promise.resolve({
          id: 123,
          code: "CTZ-V2-000123",
          name: "Test Quotation",
          customer_name: "Test Customer",
          status: "DRAFT",
          effective_status: "DRAFT",
          production_type: "RETAIL",
          created_at: "2026-09-16T12:00:00Z"
        });
      }
      return Promise.resolve({
        items: [
          {
            id: 123,
            code: "CTZ-V2-000123",
            name: "Test Quotation",
            customer_name: "Test Customer",
            status: "DRAFT",
            effective_status: "DRAFT",
            created_at: "2026-09-16T12:00:00Z"
          }
        ],
        total: 1
      });
    }),
    post: vi.fn(() => Promise.resolve({ id: 124 })),
    put: vi.fn(() => Promise.resolve({ id: 123 }))
  },
  describeError: vi.fn(() => "Error mock")
}));

function renderApp(initialEntries = ["/cotizador-v2-next"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/cotizador-v2-next" element={<CotizadorV2NextPage />} />
          <Route path="/cotizador-v2-next/:id" element={<CotizadorV2NextPage />} />
          <Route path="/cotizador-v2-next/:id/:step" element={<CotizadorV2NextPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Cotizador V2 Next - Fase 001", () => {
  it("muestra el listado de cotizaciones", async () => {
    renderApp();
    expect(await screen.findByText("Cotizaciones")).toBeInTheDocument();
    expect(await screen.findByText("Test Quotation")).toBeInTheDocument();
  });

  it("permite filtrar por búsqueda", async () => {
    renderApp();
    const input = await screen.findByPlaceholderText(/Buscar por código/i);
    fireEvent.change(input, { target: { value: "Aromas" } });
    expect(input).toHaveValue("Aromas");
  });

  it("crea un borrador y navega al paso 1", async () => {
    renderApp();
    const btn = await screen.findByText("+ Nueva cotización");
    fireEvent.click(btn);
    // After creation it navigates to /cotizador-v2-next/124/1 which shows the Wizard Shell
    expect(await screen.findByText("Paso 1 de 7")).toBeInTheDocument();
  });

  it("abre el wizard desde la lista", async () => {
    renderApp();
    const row = await screen.findByText("Test Quotation");
    fireEvent.click(row);
    expect(await screen.findByText("Paso 1 de 7")).toBeInTheDocument();
  });

  it("renderiza el paso de Cliente correctamente", async () => {
    renderApp(["/cotizador-v2-next/123/1"]);
    expect(await screen.findByText("Datos de cotización")).toBeInTheDocument();
    
    // Test the input
    const nameInput = screen.getByDisplayValue("Test Quotation");
    expect(nameInput).toBeInTheDocument();
  });
});
