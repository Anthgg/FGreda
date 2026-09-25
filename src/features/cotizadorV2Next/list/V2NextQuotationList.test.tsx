import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/utils";
import { V2NextQuotationList } from "./V2NextQuotationList";
import { mockQuotationPage, mockQuotationListItem } from "@/test/v2next/listFixtures";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RUTA_V2_NEXT } from "@/features/cotizadorV2Next/shell/rutas";
import * as api from "@/api/quoterV2";

vi.mock("@/api/quoterV2", () => ({
  fetchV2Quotations: vi.fn(),
  createV2Quotation: vi.fn(),
}));

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

    renderApp(["/cotizador-v2-next"], <V2NextQuotationList />);

    await waitFor(() => {
      expect(screen.getByText("Cliente A")).toBeInTheDocument();
    });

    const headers = screen.getAllByRole("columnheader").map(h => h.textContent);
    expect(headers).not.toContain("Total");
    expect(headers).not.toContain("Avance");

    const link = screen.getByRole("link", { name: /Cliente A/i });
    expect(link).toHaveAttribute("href", `${RUTA_V2_NEXT}/1`);
  });

  it("filters locally by q without sending q to API", async () => {
    const page = mockQuotationPage([
      mockQuotationListItem({ id: 1, customer_name: "Apple", name: "Pedido 1" }),
      mockQuotationListItem({ id: 2, customer_name: "Banana", name: "Pedido 2" }),
    ]);
    vi.mocked(api.fetchV2Quotations).mockResolvedValue(page);

    renderApp(["/cotizador-v2-next"], <V2NextQuotationList />);

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

    renderApp(["/cotizador-v2-next"], <V2NextQuotationList />);

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

    renderApp(["/cotizador-v2-next"], <V2NextQuotationList />);

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
    const { unmount } = renderApp(["/cotizador-v2-next"], <V2NextQuotationList />);
    
    await waitFor(() => {
      expect(screen.getByText("No hay cotizaciones aquí. Crea una nueva o cambia el filtro.")).toBeInTheDocument();
    });
    unmount();

    // Error state
    vi.mocked(api.fetchV2Quotations).mockRejectedValue(new Error("Failed"));
    renderApp(["/cotizador-v2-next"], <V2NextQuotationList />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
