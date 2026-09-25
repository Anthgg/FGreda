import { screen, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import React from "react";

import { V2NextClientStep } from "@/features/cotizadorV2Next/steps/V2NextClientStep";
import { COTIZACION } from "@/test/v2next/shellFixtures";
import { mockFetch, jsonResponse, csrfResponse } from "@/test/utils";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";
import type { V2Quotation } from "@/types/quoterV2";

const COTIZACION_CLIENTE: V2Quotation = {
  ...COTIZACION,
  validity_days: 7,
  tax_percent: "10.5",
  workday_hours: "6",
};

const PROPS: PasoDelAsistenteProps = {
  quotationId: 7,
  canEdit: true,
  datos: {
    cotizacion: COTIZACION_CLIENTE,
    productos: undefined,
    manoDeObra: undefined,
    quema: undefined,
    precio: undefined,
  },
  estados: [],
  irAPaso: () => {},
};

function renderStep(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("V2NextClientStep", () => {
  it("sin cotización no pinta nada", () => {
    const { container } = renderStep(<V2NextClientStep {...PROPS} datos={{ ...PROPS.datos, cotizacion: undefined }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("manda un campo a la vez en cada cambio", async () => {
    const fetcher = mockFetch((url) => url.endsWith("/auth/csrf") ? csrfResponse() : jsonResponse(200, {}));
    renderStep(<V2NextClientStep {...PROPS} />);

    // Tipo de cliente
    await userEvent.click(screen.getByRole("radio", { name: /alumno/i }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/quotations-v2/7"),
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"customer_kind":"STUDENT"'),
      })
    ));
    fetcher.mockClear();

    // Moneda
    await userEvent.click(screen.getByRole("radio", { name: /dólares/i }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/quotations-v2/7"),
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"currency_code":"USD"'),
      })
    ));
    fetcher.mockClear();

    // Tipo de pedido
    await userEvent.click(screen.getByRole("radio", { name: /por mayor/i }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/quotations-v2/7"),
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"production_type":"WHOLESALE"'),
      })
    ));
  });

  it("el tipo de cambio aparece solo en USD y es obligatorio", () => {
    const { unmount } = renderStep(<V2NextClientStep {...PROPS} />);
    expect(screen.queryByLabelText(/tipo de cambio/i)).not.toBeInTheDocument();
    unmount();

    renderStep(<V2NextClientStep {...PROPS} datos={{ ...PROPS.datos, cotizacion: { ...COTIZACION_CLIENTE, currency_code: "USD" } }} />);
    const tc = screen.getByLabelText(/tipo de cambio/i);
    expect(tc).toBeInTheDocument();
    expect(tc).toBeRequired();
  });

  it("las condiciones fijas salen de la cotización y no usan valores por defecto", () => {
    renderStep(<V2NextClientStep {...PROPS} />);
    expect(screen.getByText("7 días")).toBeInTheDocument();
    expect(screen.getByText("10.5 %")).toBeInTheDocument();
    expect(screen.getByText("6 h")).toBeInTheDocument();

    expect(screen.queryByText("20 días")).not.toBeInTheDocument();
    expect(screen.queryByText("18 %")).not.toBeInTheDocument();
    expect(screen.queryByText("8 h")).not.toBeInTheDocument();
  });

  it("texto diferido no hace petición por tecla, solo al salir (nombre al salir)", async () => {
    const fetcher = mockFetch((url) => url.endsWith("/auth/csrf") ? csrfResponse() : jsonResponse(200, {}));
    renderStep(<V2NextClientStep {...PROPS} />);

    const nombre = screen.getByLabelText(/nombre de la cotización/i);
    await userEvent.type(nombre, "Nuevo nombre");
    expect(fetcher).not.toHaveBeenCalled();

    await userEvent.tab(); // Sale del campo
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/quotations-v2/7"),
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"name":"Pedido demoNuevo nombre"'),
      })
    ));
  });

  it("canEdit=false renderiza texto estructurado (dl) sin inputs y con enlace a terceros", () => {
    renderStep(<V2NextClientStep {...PROPS} canEdit={false} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: /ver en terceros/i })).toHaveAttribute("href", "/terceros");
    expect(screen.getByText(/cliente externo/i)).toBeInTheDocument();
    expect(screen.getByText(/soles/i)).toBeInTheDocument();
    expect(screen.getByText(/por menor/i)).toBeInTheDocument();
  });

  it("muestra error de guardado general", async () => {
    mockFetch(() => { throw new TypeError("Failed to fetch"); });
    renderStep(<V2NextClientStep {...PROPS} />);

    await userEvent.click(screen.getByRole("radio", { name: /alumno/i }));
    
    expect(await screen.findByRole("alert")).toHaveTextContent(/No se pudo conectar/i);
  });
});
