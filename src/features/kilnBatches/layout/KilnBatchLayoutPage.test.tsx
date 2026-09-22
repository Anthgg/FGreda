import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderApp,
  sessionResponse,
  TEST_USER,
} from "@/test/utils";
import type {
  KilnBatch,
  KilnBatchLayout,
  KilnBatchLayoutPlacementIn,
  KilnBatchLayoutSuggestion,
  KilnBatchLayoutUpdateIn,
} from "@/types/kilnBatches";

const MOCK_BATCH: KilnBatch = {
  id: 1,
  code: "KB-2026-000001",
  kiln_id: 10,
  kiln_name_snapshot: "Horno grande",
  firing_type: "LOW",
  scheduled_date: "2026-09-25",
  status: "PLANNED",
  capacity_snapshot_cm3: "240000",
  assigned_volume_cm3: "12000",
  occupancy_percent: "5.0",
  available_percent: "95.0",
  available_cm3: "228000",
  exclusive: false,
  version: 1,
  notes: "Hornada de prueba",
  started_at: null,
  completed_at: null,
  cancelled_at: null,
  cancel_reason: null,
  assignments: [
    {
      id: 101,
      batch_id: 1,
      source_kind: "V2_QUOTATION",
      production_order_id: 5,
      internal_load_id: null,
      line_id: 1,
      product_name: "Taza de café",
      quantity: 2,
      unit_volume_cm3: "810",
      assigned_volume_cm3: "1620",
      firing_mode: "SHARED",
    },
    {
      id: 102,
      batch_id: 1,
      source_kind: "V2_QUOTATION",
      production_order_id: 5,
      internal_load_id: null,
      line_id: 2,
      product_name: "Plato hondo",
      quantity: 1,
      unit_volume_cm3: "1200",
      assigned_volume_cm3: "1200",
      firing_mode: "SHARED",
    },
  ],
};

const MOCK_LAYOUT: KilnBatchLayout = {
  id: 10,
  batch_id: 1,
  version: 1,
  kiln_width_cm_snapshot: "60.000000",
  kiln_depth_cm_snapshot: "50.000000",
  kiln_height_cm_snapshot: "80.000000",
  placed_quantity: 1,
  pending_quantity: 2,
  levels: [
    {
      level_index: 0,
      name: "Piso 1 - Base",
      z_cm: "0.000000",
      usable_height_cm: "25.000000",
      plate_label: "Placa A",
      plate_thickness_cm: "1.500000",
    },
    {
      level_index: 1,
      name: "Piso 2 - Superior",
      z_cm: "26.500000",
      usable_height_cm: "50.000000",
      plate_label: "Placa B",
      plate_thickness_cm: "1.500000",
    },
  ],
  placements: [
    {
      id: 1,
      batch_assignment_id: 101,
      group_index: 0,
      unit_index: 1,
      quantity: 1,
      level_index: 0,
      x_cm: "5.000000",
      y_cm: "5.000000",
      rotation_degrees: 0,
      piece_length_cm_snapshot: "9.000000",
      piece_width_cm_snapshot: "9.000000",
      piece_height_cm_snapshot: "10.000000",
      separation_cm_snapshot: "2.000000",
    },
  ],
};

const MOCK_SUGGESTION: KilnBatchLayoutSuggestion = {
  batch_id: 1,
  base_version: 1,
  total_pending: 2,
  suggested_count: 2,
  unplaced_count: 0,
  levels_used: [0, 1],
  suggested_placements: [
    {
      batch_assignment_id: 101,
      group_index: 0,
      unit_index: 2,
      quantity: 1,
      level_index: 0,
      x_cm: "18.000000",
      y_cm: "5.000000",
      rotation_degrees: 0,
      piece_length_cm_snapshot: "9.000000",
      piece_width_cm_snapshot: "9.000000",
      piece_height_cm_snapshot: "10.000000",
      separation_cm_snapshot: "2.000000",
    },
    {
      batch_assignment_id: 102,
      group_index: 0,
      unit_index: 1,
      quantity: 1,
      level_index: 1,
      x_cm: "5.000000",
      y_cm: "5.000000",
      rotation_degrees: 0,
      piece_length_cm_snapshot: "20.000000",
      piece_width_cm_snapshot: "20.000000",
      piece_height_cm_snapshot: "6.000000",
      separation_cm_snapshot: "2.000000",
    },
  ],
  unplaced_pieces: [],
};

interface ScenarioOptions {
  batch?: KilnBatch;
  layout?: KilnBatchLayout;
  suggestResponse?: KilnBatchLayoutSuggestion;
  putStatus?: number;
  putError?: string;
}

function layoutMock(options: ScenarioOptions = {}) {
  const {
    batch = MOCK_BATCH,
    layout = MOCK_LAYOUT,
    suggestResponse = MOCK_SUGGESTION,
    putStatus = 200,
    putError = "CONFLICT",
  } = options;

  let currentLayout = { ...layout };
  const putCalls: unknown[] = [];

  const spy = mockFetch((url: string, init: RequestInit) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return sessionResponse(TEST_USER);

    // Sugerencia M3
    if (url.includes("/layout/suggest")) {
      return jsonResponse(200, suggestResponse);
    }

    // Guardado PUT M1/M2
    if (url.includes("/layout") && init.method === "PUT") {
      if (putStatus !== 200) {
        return errorResponse(putStatus, putError);
      }
      const body = JSON.parse(String(init.body));
      putCalls.push(body);
      currentLayout = {
        ...currentLayout,
        version: currentLayout.version + 1,
        levels: body.levels,
        placements: body.placements.map((p: KilnBatchLayoutPlacementIn, idx: number) => ({
          ...p,
          id: idx + 1,
          piece_length_cm_snapshot: "9.000000",
          piece_width_cm_snapshot: "9.000000",
          piece_height_cm_snapshot: "10.000000",
          separation_cm_snapshot: "2.000000",
        })),
      };
      return jsonResponse(200, currentLayout);
    }

    // Obtener layout GET
    if (url.includes("/layout")) {
      return jsonResponse(200, currentLayout);
    }

    // Obtener hornada GET
    if (url.includes("/api/v1/kiln-batches/1")) {
      return jsonResponse(200, batch);
    }

    return errorResponse(404, "NOT_FOUND");
  });

  return { spy, putCalls };
}

describe("KilnBatchLayoutPage: Mapa interactivo del horno (M4)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza la cabecera operativa con datos físicos del horno y piezas", async () => {
    layoutMock();
    renderApp(["/produccion/hornadas/1/mapa"]);

    // Código y estado
    expect(await screen.findByText("KB-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Horno grande")).toBeInTheDocument();
    expect(screen.getByText("Planificada")).toBeInTheDocument();

    // Dimensiones físicas del horno
    expect(screen.getByText(/60 × 50 × 80 cm/i)).toBeInTheDocument();

    // Selector de niveles
    expect(screen.getByRole("tab", { name: /Piso 1 - Base/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Piso 2 - Superior/i })).toBeInTheDocument();

    // Panel de piezas pendientes
    expect(screen.getByText(/Piezas pendientes/i)).toBeInTheDocument();
    expect(screen.getByText("Taza de café")).toBeInTheDocument();
    expect(screen.getByText("Plato hondo")).toBeInTheDocument();
  });

  it("PRIVACIDAD COMERCIAL: no renderiza ningún campo comercial (precios, costos, márgenes, IGV)", async () => {
    layoutMock();
    renderApp(["/produccion/hornadas/1/mapa"]);

    await screen.findByText("KB-2026-000001");

    // Verificar que no existen palabras comerciales en la pantalla
    expect(screen.queryByText(/precio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/subtotal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/margen/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/igv/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/s\/\./i)).not.toBeInTheDocument();
  });

  it("alerta si el horno no tiene dimensiones útiles configuradas", async () => {
    const batchSinDim = { ...MOCK_BATCH };
    const layoutSinDim: KilnBatchLayout = {
      ...MOCK_LAYOUT,
      kiln_width_cm_snapshot: "0.000000",
      kiln_depth_cm_snapshot: "0.000000",
      kiln_height_cm_snapshot: "0.000000",
    };

    layoutMock({ batch: batchSinDim, layout: layoutSinDim });
    renderApp(["/produccion/hornadas/1/mapa"]);

    expect(
      await screen.findByText(/Horno sin dimensiones físicas útiles configuradas/i),
    ).toBeInTheDocument();
  });

  it("modo SOLO LECTURA cuando la hornada no está en PLANNED", async () => {
    const batchStarted: KilnBatch = {
      ...MOCK_BATCH,
      status: "STARTED",
    };

    layoutMock({ batch: batchStarted });
    renderApp(["/produccion/hornadas/1/mapa"]);

    await screen.findByText("KB-2026-000001");

    // Badge y aviso de solo lectura
    expect(screen.getByText(/Solo lectura/i)).toBeInTheDocument();

    // En modo solo lectura los botones operativos de edición no se muestran
    expect(screen.queryByRole("button", { name: /sugerir acomodo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /guardar distribución/i })).not.toBeInTheDocument();
  });

  it("inspección de pieza seleccionada: permite ver medidas y rotar 90°", async () => {
    layoutMock();
    const user = userEvent.setup();
    renderApp(["/produccion/hornadas/1/mapa"]);

    await screen.findByText("KB-2026-000001");

    // Seleccionar pieza en el mapa SVG
    const pieceItem = await screen.findByRole("button", { name: /Taza de café/i });
    await user.click(pieceItem);

    // Debe mostrarse el panel de inspección de la pieza
    expect(
      await screen.findByRole("region", { name: /Detalles de la pieza seleccionada/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("9 × 9 cm")).toBeInTheDocument();
    expect(screen.getByText("10 cm")).toBeInTheDocument();
    expect(screen.getByText("(5, 5) cm")).toBeInTheDocument();

    // Botón para rotar 90°
    const rotateBtn = screen.getByRole("button", { name: /Rotar 90° \(0°\)/i });
    await user.click(rotateBtn);

    // Ahora la rotación debe ser 90°
    expect(await screen.findByRole("button", { name: /Rotar 90° \(90°\)/i })).toBeInTheDocument();
  });

  it("sugerencia M3: previsualiza acomodo, muestra banner y permite aplicar al borrador", async () => {
    const { spy } = layoutMock();
    const user = userEvent.setup();
    renderApp(["/produccion/hornadas/1/mapa"]);

    await screen.findByText("KB-2026-000001");

    // Clic en Sugerir acomodo
    const suggestBtn = screen.getByRole("button", { name: /sugerir acomodo/i });
    await user.click(suggestBtn);

    // Debe llamarse al endpoint /layout/suggest
    await waitFor(() => {
      expect(spy.mock.calls.some(([url]) => String(url).includes("/layout/suggest"))).toBe(true);
    });

    // Debe mostrarse el banner de sugerencia
    expect(
      await screen.findByRole("region", { name: /Vista previa de sugerencia de acomodo/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Se han sugerido acomodos para/i)).toBeInTheDocument();

    // Clic en "Aplicar al borrador"
    const applyBtn = screen.getByRole("button", { name: /Aplicar al borrador/i });
    await user.click(applyBtn);

    // El banner se cierra y se marca como borrador modificado
    await waitFor(() => {
      expect(
        screen.queryByRole("region", { name: /Vista previa de sugerencia de acomodo/i }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Cambios sin guardar/i)).toBeInTheDocument();
  });

  it("guardar layout: envía niveles, placements y versión esperada vía PUT", async () => {
    const { putCalls } = layoutMock();
    const user = userEvent.setup();
    renderApp(["/produccion/hornadas/1/mapa"]);

    await screen.findByText("KB-2026-000001");

    // Seleccionar y rotar una pieza para generar un cambio
    const pieceItem = await screen.findByRole("button", { name: /Taza de café/i });
    await user.click(pieceItem);
    const rotateBtn = screen.getByRole("button", { name: /Rotar 90°/i });
    await user.click(rotateBtn);

    // Clic en Guardar distribución
    const saveBtn = screen.getByRole("button", { name: /guardar distribución/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(putCalls.length).toBe(1);
    });

    const callPayload = putCalls[0] as KilnBatchLayoutUpdateIn;
    expect(callPayload.expected_version).toBe(1);
    expect(callPayload.idempotency_key).toBeDefined();
    expect(callPayload.levels).toHaveLength(2);
    expect(callPayload.placements).toHaveLength(1);
    expect(callPayload.placements[0]?.rotation_degrees).toBe(90);
  });

  it("conflicto 409: abre modal de conflicto y permite recargar", async () => {
    layoutMock({ putStatus: 409, putError: "KILN_LAYOUT_VERSION_CONFLICT" });
    const user = userEvent.setup();
    renderApp(["/produccion/hornadas/1/mapa"]);

    await screen.findByText("KB-2026-000001");

    // Modificar borrador
    const pieceItem = await screen.findByRole("button", { name: /Taza de café/i });
    await user.click(pieceItem);
    const rotateBtn = screen.getByRole("button", { name: /Rotar 90°/i });
    await user.click(rotateBtn);

    // Clic en Guardar distribución -> respuesta 409
    const saveBtn = screen.getByRole("button", { name: /guardar distribución/i });
    await user.click(saveBtn);

    // Abre el modal de conflicto
    expect(await screen.findByRole("dialog", { name: /Conflicto de versión \(409\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recargar desde servidor/i })).toBeInTheDocument();
  });
});
