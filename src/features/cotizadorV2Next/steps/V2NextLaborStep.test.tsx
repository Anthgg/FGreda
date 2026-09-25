import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatCosto } from "@/features/cotizadorV2/moneda";
import { V2NextLaborStep } from "@/features/cotizadorV2Next/steps/V2NextLaborStep";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";
import {
  COTIZACION_TRABAJO,
  COTIZACION_TRABAJO_USD,
  ILUSTRACION_TRABAJO,
  MANO_DE_OBRA_TRABAJO,
  PROCESOS_TRABAJO,
  PRODUCTOS_TRABAJO,
  TECNICAS_TRABAJO,
  TRABAJADORES_TRABAJO,
} from "@/test/v2next/laborFixtures";
import type { V2Illustration, V2LaborPage, V2Technique, V2Worker } from "@/types/quoterV2Labor";
import type { V2QuotationProductsPage } from "@/types/quoterV2Materials";
import type { V2ProcessPage } from "@/types/quoterV2Processes";

const hooks = vi.hoisted(() => ({
  laborQuery: undefined as unknown,
  processesQuery: undefined as unknown,
  productsQuery: undefined as unknown,
  workersQuery: undefined as unknown,
  techniquesQuery: undefined as unknown,
  illustrationQuery: undefined as unknown,
  esperar: vi.fn(),
  assignProcess: vi.fn(),
  removeProcess: vi.fn(),
  setProcessQuantity: vi.fn(),
  addProcess: vi.fn(),
  updateLabor: vi.fn(),
  deleteLabor: vi.fn(),
  addLabor: vi.fn(),
  setPlanning: vi.fn(),
  setIllustration: vi.fn(),
}));

function mutacion(mutate: ReturnType<typeof vi.fn>) {
  return {
    mutate,
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  };
}

vi.mock("@/features/cotizadorV2/useQuoterV2Labor", () => ({
  useV2Labor: vi.fn(() => hooks.laborQuery),
  useV2Workers: vi.fn(() => hooks.workersQuery),
  useV2Techniques: vi.fn(() => hooks.techniquesQuery),
  useUpdateV2Labor: vi.fn(() => mutacion(hooks.updateLabor)),
  useDeleteV2Labor: vi.fn(() => mutacion(hooks.deleteLabor)),
  useAddV2Labor: vi.fn(() => mutacion(hooks.addLabor)),
  useSetV2Planning: vi.fn(() => mutacion(hooks.setPlanning)),
  useV2Illustration: vi.fn(() => hooks.illustrationQuery),
  useSetV2Illustration: vi.fn(() => mutacion(hooks.setIllustration)),
}));

vi.mock("@/features/cotizadorV2/useQuoterV2Materials", () => ({
  useV2QuotationProducts: vi.fn(() => hooks.productsQuery),
}));

vi.mock("@/features/cotizadorV2/useQuoterV2Processes", () => ({
  useV2Processes: vi.fn(() => hooks.processesQuery),
  useAssignV2Process: vi.fn(() => mutacion(hooks.assignProcess)),
  useRemoveV2Process: vi.fn(() => mutacion(hooks.removeProcess)),
  useSetV2ProcessQuantity: vi.fn(() => mutacion(hooks.setProcessQuantity)),
  useAddV2Process: vi.fn(() => mutacion(hooks.addProcess)),
}));

vi.mock("@/features/cotizadorV2/claves", () => ({
  useEsperarGuardado: vi.fn(() => hooks.esperar),
}));

function consultaOk<T>(data: T) {
  return { data, isPending: false, isError: false, error: null };
}

function prepararConsultas(
  opciones: {
    labor?: V2LaborPage & { warnings?: string[] };
    processes?: V2ProcessPage;
    products?: V2QuotationProductsPage;
    workers?: { items: V2Worker[] };
    techniques?: { items: V2Technique[] };
    illustration?: V2Illustration;
  } = {},
) {
  hooks.laborQuery = consultaOk(opciones.labor ?? MANO_DE_OBRA_TRABAJO);
  hooks.processesQuery = consultaOk(opciones.processes ?? PROCESOS_TRABAJO);
  hooks.productsQuery = consultaOk(opciones.products ?? PRODUCTOS_TRABAJO);
  hooks.workersQuery = consultaOk(opciones.workers ?? TRABAJADORES_TRABAJO);
  hooks.techniquesQuery = consultaOk(opciones.techniques ?? TECNICAS_TRABAJO);
  hooks.illustrationQuery = consultaOk(opciones.illustration ?? ILUSTRACION_TRABAJO);
}

function renderPaso(
  opciones: {
    canEdit?: boolean;
    cotizacion?: PasoDelAsistenteProps["datos"]["cotizacion"];
    irAPaso?: PasoDelAsistenteProps["irAPaso"];
  } = {},
) {
  const props: PasoDelAsistenteProps = {
    quotationId: 7,
    canEdit: opciones.canEdit ?? true,
    datos: {
      cotizacion: opciones.cotizacion ?? COTIZACION_TRABAJO,
      productos: undefined,
      manoDeObra: undefined,
      quema: undefined,
      precio: undefined,
    },
    estados: [],
    irAPaso: opciones.irAPaso ?? vi.fn(),
  };
  return render(<V2NextLaborStep {...props} />);
}

async function elegir(
  user: ReturnType<typeof userEvent.setup>,
  base: typeof screen | ReturnType<typeof within>,
  campo: string,
  opcion: RegExp,
) {
  await user.click(base.getByRole("combobox", { name: campo }));
  await user.click(await screen.findByRole("option", { name: opcion }));
}

function proceso(id: number) {
  return within(screen.getByTestId(`labor-process-${id}`));
}

describe("V2NextLaborStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.esperar.mockResolvedValue({ ok: true, firma: "guardado", fresco: false });
    prepararConsultas();
  });

  it("asigna y desasigna procesos con el payload real, filtrando trabajadores capaces", async () => {
    const user = userEvent.setup();
    renderPaso();
    const fila = proceso(501);

    await user.click(fila.getByRole("combobox", { name: "Lo hace" }));
    expect(await screen.findByRole("option", { name: "Celso (Taller)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Refuerzo externo (Externo)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Pintora (Externo)" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Refuerzo externo (Externo)" }));
    expect(hooks.assignProcess).toHaveBeenLastCalledWith({ processId: 501, workerId: 2 });

    await elegir(user, fila, "Lo hace", /^Sin asignar$/);
    expect(hooks.assignProcess).toHaveBeenLastCalledWith({ processId: 501, workerId: null });
  });

  it("guarda piezas de proceso al salir del campo, nunca por tecla", async () => {
    const user = userEvent.setup();
    renderPaso();
    const piezas = proceso(501).getByRole("textbox", { name: /Piezas por trabajar/ });

    await user.clear(piezas);
    await user.type(piezas, "25,5");
    expect(hooks.esperar).not.toHaveBeenCalled();

    fireEvent.blur(piezas);
    await waitFor(() => expect(hooks.esperar).toHaveBeenCalled());
    expect(hooks.esperar).toHaveBeenLastCalledWith(expect.any(Object), "proceso-editar", {
      processId: 501,
      quantity: "25.5",
    });
  });

  it("quita y agrega procesos con los payloads esperados", async () => {
    const user = userEvent.setup();
    renderPaso();

    await user.click(screen.getByRole("button", { name: "Quitar Vidriado de esta cotización" }));
    expect(hooks.removeProcess).toHaveBeenLastCalledWith(501);

    const pieza = within(screen.getByTestId("labor-piece-11"));
    await elegir(user, pieza, "Agregar proceso", /Aplique/);
    await user.click(pieza.getByRole("button", { name: "Agregar" }));
    expect(hooks.addProcess).toHaveBeenLastCalledWith(
      { v2_quotation_product_id: 11, technique_id: 5 },
      expect.any(Object),
    );
  });

  it("edita horas finales, vuelve al estándar y guarda tarifa acordada", async () => {
    const user = userEvent.setup();
    renderPaso();
    await user.click(proceso(501).getByText("Ajustar horas y tarifa"));

    const horas = proceso(501).getByRole("textbox", { name: /Horas finales/ });
    await user.clear(horas);
    await user.type(horas, "6");
    fireEvent.blur(horas);
    await waitFor(() =>
      expect(hooks.esperar).toHaveBeenLastCalledWith(expect.any(Object), "tarea-editar", {
        laborId: 601,
        payload: { final_hours_override: "6" },
      }),
    );

    await user.click(proceso(501).getByRole("button", { name: /Volver al estándar/ }));
    expect(hooks.updateLabor).toHaveBeenLastCalledWith({
      laborId: 601,
      payload: { final_hours_override: null },
    });

    hooks.esperar.mockClear();
    const tarifa = proceso(501).getByRole("textbox", { name: /Tarifa acordada por hora/ });
    await user.clear(tarifa);
    await user.type(tarifa, "21,5");
    fireEvent.blur(tarifa);
    await waitFor(() =>
      expect(hooks.esperar).toHaveBeenLastCalledWith(expect.any(Object), "tarea-editar", {
        laborId: 601,
        payload: { hourly_rate_override: "21.5" },
      }),
    );
  });

  it("edita, quita y crea personal adicional sin campos libres", async () => {
    const user = userEvent.setup();
    renderPaso();
    const apoyo = within(screen.getByText("Refuerzo externo · Pulido").closest("li") as HTMLElement);

    await elegir(user, apoyo, "Pieza", /Plato palta/);
    expect(hooks.updateLabor).toHaveBeenLastCalledWith({
      laborId: 602,
      payload: { v2_quotation_product_id: 11 },
    });

    const cantidad = apoyo.getByRole("textbox", { name: /Piezas por trabajar/ });
    await user.clear(cantidad);
    await user.type(cantidad, "12");
    fireEvent.blur(cantidad);
    await waitFor(() =>
      expect(hooks.esperar).toHaveBeenLastCalledWith(expect.any(Object), "tarea-editar", {
        laborId: 602,
        payload: { quantity: "12" },
      }),
    );

    await user.click(apoyo.getByRole("button", { name: "Quitar" }));
    expect(hooks.deleteLabor).toHaveBeenLastCalledWith(602);

    const seccion = within(
      screen.getByRole("heading", { name: "Personal adicional y apoyo" }).closest("section") as HTMLElement,
    );
    await elegir(user, seccion, "Trabajador de apoyo", /Pintora/);
    await elegir(user, seccion, "Técnica que sabe", /Aplique/);
    await user.click(seccion.getAllByRole("combobox", { name: "Pieza" }).at(-1) as HTMLElement);
    await user.click(await screen.findByRole("option", { name: /Taza luna/ }));
    await user.click(seccion.getByRole("button", { name: "Añadir personal" }));
    expect(hooks.addLabor).toHaveBeenLastCalledWith(
      {
        worker_id: 3,
        technique_id: 5,
        v2_quotation_product_id: 12,
        is_additional_personnel: true,
      },
      expect.any(Object),
    );
    expect(screen.queryByLabelText(/nombre/i)).not.toBeInTheDocument();
  });

  it("guarda días al salir del campo y la sugerencia solo cuando se pulsa", async () => {
    const user = userEvent.setup();
    renderPaso();
    const dias = screen.getByRole("textbox", { name: /¿Cuántos días le dedicarás\?/ });

    await user.clear(dias);
    await user.type(dias, "3");
    expect(hooks.esperar).not.toHaveBeenCalled();
    fireEvent.blur(dias);
    await waitFor(() =>
      expect(hooks.esperar).toHaveBeenLastCalledWith(expect.any(Object), "planificacion", 3),
    );

    hooks.esperar.mockClear();
    await user.click(screen.getByRole("button", { name: "Usar sugerencia" }));
    expect(hooks.esperar).toHaveBeenLastCalledWith(expect.any(Object), "planificacion", 2);
  });

  it("prende y apaga ilustración y guarda piezas por línea con la lista completa", async () => {
    const user = userEvent.setup();
    renderPaso();

    await user.click(screen.getByRole("switch", { name: "Lleva ilustración" }));
    expect(hooks.setIllustration).toHaveBeenLastCalledWith({ illustration_enabled: false });

    const plato = screen.getByRole("textbox", { name: /Piezas a ilustrar · Plato palta/ });
    await user.clear(plato);
    await user.type(plato, "8");
    fireEvent.blur(plato);
    await waitFor(() =>
      expect(hooks.esperar).toHaveBeenLastCalledWith(expect.any(Object), "ilustracion", {
        lines: [
          { line_id: 11, quantity: "8" },
          { line_id: 12, quantity: "0.000000" },
        ],
      }),
    );

    hooks.esperar.mockClear();
    const sinProducto = screen.getByRole("textbox", { name: /Piezas sin producto asignado/ });
    await user.clear(sinProducto);
    await user.type(sinProducto, "4");
    fireEvent.blur(sinProducto);
    await waitFor(() =>
      expect(hooks.esperar).toHaveBeenLastCalledWith(expect.any(Object), "ilustracion", {
        illustration_quantity: "4",
      }),
    );
    expect(screen.queryByRole("textbox", { name: /horas de ilustración/i })).not.toBeInTheDocument();
  });

  it("dice avisos en palabras y mantiene costos en soles aunque la cotización esté en USD", () => {
    renderPaso({ cotizacion: COTIZACION_TRABAJO_USD });

    expect(screen.getByTestId("v2next-labor-total")).toHaveTextContent(formatCosto("200.000000"));
    expect(screen.getAllByText(formatCosto("0.000000")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Las horas asignadas superan la jornada configurada/)).toBeInTheDocument();
    expect(
      screen.getByText("Hay un aviso del cálculo de mano de obra. Revise esta parte del trabajo."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/V2_/)).not.toBeInTheDocument();
  });

  it("en solo lectura muestra datos estructurados, no inputs deshabilitados", () => {
    renderPaso({ canEdit: false });

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getAllByText("Celso").length).toBeGreaterThan(0);
    expect(screen.getByText("Sin asignar: aún no cuesta")).toBeInTheDocument();
    expect(screen.getByText("2 días")).toBeInTheDocument();
  });

  it("si no hay piezas ofrece volver al paso Piezas", async () => {
    const user = userEvent.setup();
    const irAPaso = vi.fn();
    prepararConsultas({ products: { items: [], materials_cost: "0" } });
    renderPaso({ irAPaso });

    await user.click(screen.getByRole("button", { name: "Ir a Piezas" }));
    expect(irAPaso).toHaveBeenCalledWith("productos");
  });
});
