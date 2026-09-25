import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { V2NextQuotationList } from "./V2NextQuotationList";
import { mockQuotationPage, mockQuotationListItem } from "@/test/v2next/listFixtures";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RUTA_V2_NEXT } from "@/features/cotizadorV2Next/shell/rutas";
import * as api from "@/api/quoterV2";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";

vi.mock("@/api/quoterV2", () => ({
  fetchV2Quotations: vi.fn(),
  createV2Quotation: vi.fn(),
}));

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("V2NextQuotationList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders list and filters out Total/Avance columns", async () => {
    const page = mockQuotationPage([
      mockQuotationListItem({ id: 1, customer_name: "Cliente A", name: "Pedido 1", code: "V2-001" })
    ]);
    vi.mocked(api.fetchV2Quotations).mockResolvedValue(page);

    renderWithProviders(<V2NextQuotationList />);

    await waitFor(() => {
      expect(screen.getByText("Cliente A")).toBeInTheDocument();
    });

    const headers = screen.getAllByRole("columnheader").map(h => h.textContent);
    expect(headers).not.toContain("Total");
    expect(headers).not.toContain("Avance");

    const link = screen.getByRole("link", { name: /Cliente A/i });
    expect(link).toHaveAttribute("href", `${RUTA_V2_NEXT}/1`);
  });

  it("la fecha de creación es un instante y se pinta en hora de Lima", async () => {
    // El backend manda `created_at` como datetime; `formatDisplayDate` solo
    // entiende YYYY-MM-DD y dejaba la columna vacía con datos reales.
    vi.mocked(api.fetchV2Quotations).mockResolvedValue(
      mockQuotationPage([
        mockQuotationListItem({ id: 1, customer_name: "Cliente A", created_at: "2026-09-21T03:30:00Z" }),
      ]),
    );

    renderWithProviders(<V2NextQuotationList />);

    const row = await screen.findByRole("row", { name: /Cliente A/i });
    expect(within(row).getByText("20/09/2026")).toBeInTheDocument();
  });

  it("has exactly ONE link per row", async () => {
    const page = mockQuotationPage([
      mockQuotationListItem({ id: 1, customer_name: "Cliente A", name: "Pedido 1", code: "V2-001" })
    ]);
    vi.mocked(api.fetchV2Quotations).mockResolvedValue(page);

    renderWithProviders(<V2NextQuotationList />);

    await waitFor(() => {
      expect(screen.getByText("Cliente A")).toBeInTheDocument();
    });

    const row = screen.getByRole("row", { name: /Cliente A/i });
    const linksInRow = within(row).getAllByRole("link");
    expect(linksInRow).toHaveLength(1);
  });

  it("filters locally by q without sending q to API", async () => {
    const page = mockQuotationPage([
      mockQuotationListItem({ id: 1, customer_name: "Apple", name: "Pedido 1" }),
      mockQuotationListItem({ id: 2, customer_name: "Banana", name: "Pedido 2" }),
    ]);
    vi.mocked(api.fetchV2Quotations).mockResolvedValue(page);

    renderWithProviders(<V2NextQuotationList />);

    await waitFor(() => {
      expect(screen.getByText("Apple")).toBeInTheDocument();
      expect(screen.getByText("Banana")).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText("Buscar");
    await userEvent.type(searchInput, "apple");

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.queryByText("Banana")).not.toBeInTheDocument();

    expect(api.fetchV2Quotations).toHaveBeenCalledTimes(1);
    expect(api.fetchV2Quotations).toHaveBeenCalledWith({ limit: 50 });
  });

  it("sends status filter to API", async () => {
    vi.mocked(api.fetchV2Quotations).mockResolvedValue(mockQuotationPage([]));

    renderWithProviders(<V2NextQuotationList />);

    await waitFor(() => {
      expect(api.fetchV2Quotations).toHaveBeenCalledWith({ limit: 50 });
    });

    const draftRadio = screen.getByRole("radio", { name: /Borradores/i });
    await userEvent.click(draftRadio);

    await waitFor(() => {
      expect(api.fetchV2Quotations).toHaveBeenCalledWith({ limit: 50, status: "DRAFT" });
    });
  });

  it("increases limit when clicking Mostrar más up to 200", async () => {
    const page = mockQuotationPage(
      Array.from({ length: 50 }).map((_, i) => mockQuotationListItem({ id: i + 1 })),
      150
    );
    const nextPage = { ...page, items: Array.from({ length: 100 }).map((_, i) => mockQuotationListItem({ id: i + 1 })) };
    
    vi.mocked(api.fetchV2Quotations)
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce(nextPage);

    renderWithProviders(<V2NextQuotationList />);

    await waitFor(() => {
      expect(screen.getByText("Buscando en las 50 más recientes de 150.")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Mostrar más" }));

    await waitFor(() => {
      expect(api.fetchV2Quotations).toHaveBeenCalledWith({ limit: 100 });
      expect(screen.getByText("Buscando en las 100 más recientes de 150.")).toBeInTheDocument();
    });
  });

  it("handles loading, error, and empty states", async () => {
    // Empty state
    vi.mocked(api.fetchV2Quotations).mockResolvedValue(mockQuotationPage([]));
    const { unmount } = renderWithProviders(<V2NextQuotationList />);
    
    await waitFor(() => {
      expect(screen.getByText("No hay cotizaciones aquí. Crea una nueva o cambia el filtro.")).toBeInTheDocument();
    });
    unmount();

    // Error state
    vi.mocked(api.fetchV2Quotations).mockRejectedValue(new Error("Failed"));
    renderWithProviders(<V2NextQuotationList />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
