import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@/test/utils";
import { V2CreateQuotationDialog } from "./V2CreateQuotationDialog";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as api from "@/api/quoterV2";
import * as masterApi from "@/api/masters";

vi.mock("@/api/quoterV2", () => ({
  createV2Quotation: vi.fn(),
}));

vi.mock("@/api/masters", () => ({
  fetchPartners: vi.fn(),
}));

describe("V2CreateQuotationDialog", () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(masterApi.fetchPartners).mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders accessible dialog and closes on Escape", async () => {
    renderApp(["/"], <V2CreateQuotationDialog onClose={onClose} onSuccess={onSuccess} />);

    const dialog = screen.getByRole("dialog", { name: "Nueva cotización" });
    expect(dialog).toBeInTheDocument();
    
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("sends single POST and navigates based on customer selection", async () => {
    vi.mocked(api.createV2Quotation).mockResolvedValue({ id: 7 } as unknown as api.V2Quotation);

    renderApp(["/"], <V2CreateQuotationDialog onClose={onClose} onSuccess={onSuccess} />);

    const nameInput = screen.getByLabelText("Ponle un nombre (opcional)");
    await userEvent.type(nameInput, "My Order");

    const submitBtn = screen.getByRole("button", { name: "Empezar cotización" });
    
    await userEvent.click(submitBtn);
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createV2Quotation).toHaveBeenCalledTimes(1);
    });

    expect(api.createV2Quotation).toHaveBeenCalledWith({
      name: "My Order",
      customer_id: null,
      production_type: "RETAIL"
    });

    expect(onSuccess).toHaveBeenCalledWith(7, false);
  });

  it("shows error without closing", async () => {
    vi.mocked(api.createV2Quotation).mockRejectedValue(new Error("Bad Request"));

    renderApp(["/"], <V2CreateQuotationDialog onClose={onClose} onSuccess={onSuccess} />);

    const submitBtn = screen.getByRole("button", { name: "Empezar cotización" });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    
    expect(onClose).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
