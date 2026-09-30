import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { V2NextKilnStep } from "@/features/cotizadorV2Next/steps/V2NextKilnStep";
import { COTIZACION_HORNO, QUEMA_HORNO, crearQuemaHorno } from "@/test/v2next/kilnFixtures";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";
import type { V2Firing } from "@/types/quoterV2Firing";

const hooks = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  esperar: vi.fn(),
  query: undefined as unknown,
}));

vi.mock("@/features/cotizadorV2/useQuoterV2Firing", () => ({
  useV2Firing: vi.fn(() => hooks.query),
  useSetV2Firing: vi.fn(() => ({
    mutate: hooks.mutate,
    mutateAsync: hooks.mutateAsync,
    isError: false,
    error: null,
  })),
}));

vi.mock("@/features/cotizadorV2/claves", () => ({
  useEsperarGuardado: vi.fn(() => hooks.esperar),
}));

function consultaOk(data: V2Firing = QUEMA_HORNO) {
  return { data, isPending: false, isError: false, error: null };
}

function renderPaso(opciones: {
  quema?: V2Firing;
  canEdit?: boolean;
  irAPaso?: PasoDelAsistenteProps["irAPaso"];
} = {}) {
  const irAPaso = opciones.irAPaso ?? vi.fn();
  hooks.query = consultaOk(opciones.quema ?? QUEMA_HORNO);
  const props: PasoDelAsistenteProps = {
    quotationId: 7,
    canEdit: opciones.canEdit ?? true,
    datos: {
      cotizacion: COTIZACION_HORNO,
      productos: undefined,
      manoDeObra: undefined,
      quema: undefined,
      precio: undefined,
    },
    estados: [],
    irAPaso,
  };
  return { ...render(<V2NextKilnStep {...props} />), irAPaso };
}

async function abrirAvanzado(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Ajustes de carga y tarifas"));
}

describe("V2NextKilnStep", () => {
  beforeEach(() => {
    hooks.mutate.mockReset();
    hooks.mutateAsync.mockReset();
    hooks.esperar.mockReset();
    hooks.esperar.mockResolvedValue({ ok: true, firma: "quema", fresco: false });
    hooks.query = consultaOk();
  });

  it("elegir horno manda solo kiln_id", async () => {
    const user = userEvent.setup();
    renderPaso();

    await user.click(screen.getByRole("radio", { name: /Horno grande/ }));

    expect(hooks.mutate).toHaveBeenCalledWith({ kiln_id: 2 });
  });

  it("cambiar el modo manda solo firing_mode", async () => {
    const user = userEvent.setup();
    renderPaso();

    await user.click(screen.getByRole("radio", { name: /Solo este pedido/ }));

    expect(hooks.mutate).toHaveBeenCalledWith({ firing_mode: "EXCLUSIVE" });
  });

  it("prender y apagar las quemas manda solo el campo cambiado", async () => {
    const user = userEvent.setup();
    renderPaso();

    await user.click(screen.getByRole("switch", { name: "Primera quema (baja)" }));
    expect(hooks.mutate).toHaveBeenLastCalledWith({ low_fire_enabled: false });

    await user.click(screen.getByRole("switch", { name: "Segunda quema (alta)" }));
    expect(hooks.mutate).toHaveBeenLastCalledWith({ high_fire_enabled: false });
  });

  it.each([
    ["Separación entre piezas", "4,5", { piece_separation_cm: "4.5" }],
    ["Tarifa baja", "220", { commercial_rate_low_override: "220" }],
  ])("guarda %s al salir del campo", async (campo, entrada, payload) => {
    const user = userEvent.setup();
    renderPaso();
    await abrirAvanzado(user);

    const input = screen.getByRole("textbox", { name: new RegExp(campo) });
    await user.clear(input);
    await user.type(input, entrada);
    expect(hooks.esperar).not.toHaveBeenCalled();

    await user.tab();
    await waitFor(() => expect(hooks.esperar).toHaveBeenCalled());
    expect(hooks.esperar).toHaveBeenLastCalledWith(expect.any(Object), "quema", payload);
  });

  it("vaciar separación y overrides manda null", async () => {
    const user = userEvent.setup();
    renderPaso();
    await abrirAvanzado(user);

    const separacion = screen.getByRole("textbox", { name: /Separación entre piezas/ });
    await user.clear(separacion);
    await user.tab();
    await waitFor(() =>
      expect(hooks.esperar).toHaveBeenLastCalledWith(expect.any(Object), "quema", {
        piece_separation_cm: null,
      }),
    );

    const gas = screen.getByRole("textbox", { name: /Gas alta/ });
    await user.clear(gas);
    await user.tab();
    await waitFor(() =>
      expect(hooks.esperar).toHaveBeenLastCalledWith(expect.any(Object), "quema", {
        gas_cost_high_override: null,
      }),
    );
  });

  it("marca Recomendado solo en el horno recomendado y muestra Sin tarifas", () => {
    renderPaso();

    expect(within(screen.getByTestId("kiln-option-2")).getByText("Recomendado")).toBeInTheDocument();
    expect(within(screen.getByTestId("kiln-option-1")).queryByText("Recomendado")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("kiln-option-3")).getByText("Sin tarifas")).toBeInTheDocument();
  });

  it("no enseña dimensiones físicas de hornos", () => {
    renderPaso();

    expect(screen.getByTestId("v2next-paso-horno").textContent).not.toMatch(
      /\b(72|77|90|34|28|40)\s*cm\b/,
    );
  });

  it("muestra cliente y producción en solo lectura y lleva al paso Cliente", async () => {
    const user = userEvent.setup();
    const irAPaso = vi.fn();
    renderPaso({ irAPaso });

    expect(screen.getByText("Cliente externo")).toBeInTheDocument();
    expect(screen.getByText("Por menor")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cambiar en Cliente" }));
    expect(irAPaso).toHaveBeenCalledWith("cliente");
  });

  it("mantiene costos en soles aunque la cotización esté en USD", async () => {
    const user = userEvent.setup();
    renderPaso();
    await abrirAvanzado(user);

    expect(screen.getByTestId("v2next-sugerencia-horno")).toHaveTextContent("S/ 225.00");
    expect(screen.getAllByText("S/ 1125.00").length).toBeGreaterThan(0);
    expect(screen.queryByText(/US\$/)).not.toBeInTheDocument();
  });

  it("los avisos se dicen en palabras, sin códigos crudos", () => {
    renderPaso();

    const avisos = screen.getByTestId("v2next-avisos-horno");
    expect(avisos).toHaveTextContent("Aviso:");
    expect(avisos).toHaveTextContent("Recomendación:");
    expect(avisos).toHaveTextContent("Hay un aviso de quema para esta cotización");
    expect(avisos).not.toHaveTextContent("V2_");
  });

  it("en solo lectura muestra valores estructurados, no inputs", async () => {
    const user = userEvent.setup();
    renderPaso({ canEdit: false, quema: crearQuemaHorno({ firing_mode: "EXCLUSIVE" }) });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByText("Horno chico")).toBeInTheDocument();
    expect(screen.getByText("Exclusiva / urgente")).toBeInTheDocument();

    await abrirAvanzado(user);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("3.000000 cm")).toBeInTheDocument();
  });
});
