import { expect, test, type Page } from "@playwright/test";

import { login } from "../helpers/auth";

const MOCK_BATCH = {
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
  kiln_width_cm_snapshot: "60.000000",
  kiln_depth_cm_snapshot: "50.000000",
  kiln_height_cm_snapshot: "80.000000",
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
  ],
};

const MOCK_LAYOUT = {
  id: 10,
  batch_id: 1,
  version: 1,
  kiln_width_cm_snapshot: "60.000000",
  kiln_depth_cm_snapshot: "50.000000",
  kiln_height_cm_snapshot: "80.000000",
  placed_quantity: 1,
  pending_quantity: 1,
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

const MOCK_SUGGESTION = {
  batch_id: 1,
  base_version: 1,
  total_pending: 1,
  suggested_count: 1,
  unplaced_count: 0,
  levels_used: [0],
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
  ],
  unplaced_pieces: [],
};

const MOCK_USER = {
  id: "11111111-2222-3333-4444-555555555555",
  email: "admin@empresa.com",
  display_name: "Administrador",
  role: "ADMIN" as const,
};

async function setupAuthRoutes(page: Page) {
  let authenticated = false;

  await page.route("**/api/v1/auth/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrf_token: "mock-csrf-token", expires_in: 28800 }),
    });
  });

  await page.route("**/api/v1/auth/login", async (route) => {
    authenticated = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        user: MOCK_USER,
      }),
    });
  });

  await page.route("**/api/v1/auth/me", async (route) => {
    if (!authenticated) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "NOT_AUTHENTICATED" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          user: MOCK_USER,
        }),
      });
    }
  });
}

interface MockPlacement {
  id?: number | string;
  batch_assignment_id: number;
  group_index: number;
  unit_index: number;
  quantity: number;
  level_index: number;
  x_cm: string;
  y_cm: string;
  rotation_degrees: number;
  piece_length_cm_snapshot?: string;
  piece_width_cm_snapshot?: string;
  piece_height_cm_snapshot?: string;
  separation_cm_snapshot?: string;
}

interface MockLevel {
  level_index: number;
  name?: string;
  z_cm: string;
  usable_height_cm: string;
  plate_label?: string | null;
  plate_thickness_cm?: string | null;
}

interface MockPutPayload {
  expected_version: number;
  idempotency_key?: string;
  levels?: MockLevel[];
  placements?: MockPlacement[];
}

test.describe("Mapa interactivo de distribución física del horno (Fase 010M - M4)", () => {
  test("CORE FLOW: abrir hornadas -> mapa -> sugerir -> preview -> aplicar -> seleccionar -> rotar -> mover -> guardar -> comprobar PUT -> recargar persistencia", async ({
    page,
  }) => {
    await setupAuthRoutes(page);

    let currentLayout = { ...MOCK_LAYOUT };
    const putCalls: MockPutPayload[] = [];

    await page.route(/\/api\/v1\/kiln-batches(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [MOCK_BATCH],
          total: 1,
          limit: 20,
          offset: 0,
        }),
      });
    });

    await page.route("**/api/v1/kiln-batches/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BATCH),
      });
    });

    await page.route("**/api/v1/kiln-batches/1/layout/suggest", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SUGGESTION),
      });
    });

    await page.route("**/api/v1/kiln-batches/1/layout", async (route) => {
      if (route.request().method() === "PUT") {
        const body = JSON.parse(route.request().postData() || "{}");
        putCalls.push(body);
        currentLayout = {
          ...currentLayout,
          version: body.expected_version + 1,
          levels: body.levels,
          placements: body.placements.map((p: MockPlacement, idx: number) => ({
            ...p,
            id: p.id ?? idx + 1,
            piece_length_cm_snapshot: "9.000000",
            piece_width_cm_snapshot: "9.000000",
            piece_height_cm_snapshot: "10.000000",
            separation_cm_snapshot: "2.000000",
          })),
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(currentLayout),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(currentLayout),
        });
      }
    });

    await login(page);

    // 1. Ir a hornadas
    await page.goto("/produccion/hornadas");
    await expect(page.getByRole("heading", { name: "Hornadas." })).toBeVisible();

    // 2. Clic en enlace a mapa físico
    const mapLink = page.getByRole("link", { name: /mapa y distribución del horno/i }).first();
    await expect(mapLink).toBeVisible();
    await mapLink.click();

    // 3. Validar URL y cabecera
    await expect(page).toHaveURL(/\/produccion\/hornadas\/1\/mapa/);
    await expect(
      page.getByRole("heading", { name: /mapa de distribución física del horno/i }),
    ).toBeVisible();

    // 4. Validar dimensiones útiles
    await expect(page.getByText(/60 × 50 × 80 cm/i)).toBeVisible();

    // 5. Sugerir acomodo
    const suggestBtn = page.getByRole("button", { name: /sugerir acomodo/i });
    await expect(suggestBtn).toBeVisible();
    await suggestBtn.click();

    // 6. Validar preview de sugerencia visible
    await expect(
      page.getByRole("region", { name: /vista previa de sugerencia de acomodo/i }),
    ).toBeVisible();

    // 7. Aplicar sugerencia al borrador
    const applyBtn = page.getByRole("button", { name: /aplicar al borrador/i });
    await applyBtn.click();
    await expect(
      page.getByRole("region", { name: /vista previa de sugerencia de acomodo/i }),
    ).not.toBeVisible();

    // 8. Seleccionar pieza en SVG
    const piece = page.getByRole("button", { name: /taza de café/i }).first();
    await expect(piece).toBeVisible();
    await piece.click();

    // 9. Validar panel de pieza seleccionada
    await expect(
      page.getByRole("region", { name: /detalles de la pieza seleccionada/i }),
    ).toBeVisible();

    // 10. Rotar pieza 90°
    const rotateBtn = page.getByRole("button", { name: /rotar 90°/i });
    await rotateBtn.click();

    // 11. Mover pieza al Nivel 2 (obligatorio)
    const moveBtn = page.getByRole("button", { name: /mover pieza al piso 2 - superior/i });
    await expect(moveBtn).toBeVisible();
    await moveBtn.click();

    // Validar en el panel que la pieza se movió a Piso 2 y rotó a 90°
    await expect(page.locator("div").filter({ hasText: "Nivel actual:" }).first()).toContainText(
      "Piso 2 - Superior",
    );
    await expect(page.getByRole("button", { name: /rotar 90° \(90°\)/i })).toBeVisible();

    // 12. Guardar distribución (PUT)
    const saveBtn = page.getByRole("button", { name: /guardar distribución/i });
    await saveBtn.click();

    // 13. Comprobar que PUT ocurrió con expected_version y cambios aplicados
    await expect.poll(() => putCalls.length).toBeGreaterThan(0);
    const lastPut = putCalls[putCalls.length - 1];
    expect(lastPut?.expected_version).toBe(1);
    expect(lastPut?.idempotency_key).toBeDefined();
    const placed = lastPut?.placements?.find(
      (p: MockPlacement) => p.batch_assignment_id === 101,
    );
    expect(placed).toBeDefined();
    expect(placed?.level_index).toBe(1);
    expect(placed?.rotation_degrees).toBe(90);

    // 14. Mensaje de éxito
    await expect(page.getByText(/guardada exitosamente/i)).toBeVisible();

    // 15. Recargar la página y validar persistencia desde el servidor (versión 2, pieza en Piso 2 a 90°)
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /mapa de distribución física del horno/i }),
    ).toBeVisible();
    await expect(page.getByText(/versión: 2/i)).toBeVisible();

    // Cambiar a Piso 2 para inspeccionar la pieza
    const level2SelectorTab = page.getByRole("tab", { name: /piso 2 - superior/i });
    await expect(level2SelectorTab).toBeVisible();
    await level2SelectorTab.click();

    const pieceAfterReload = page.getByRole("button", { name: /taza de café/i }).first();
    await expect(pieceAfterReload).toBeVisible();
    await pieceAfterReload.click();
    await expect(page.locator("div").filter({ hasText: "Nivel actual:" }).first()).toContainText(
      "Piso 2 - Superior",
    );
    await expect(page.getByRole("button", { name: /rotar 90° \(90°\)/i })).toBeVisible();
  });

  test("EMPTY_LAYOUT: GET layout 404 -> renderiza estado inicial -> añadir nivel -> guardar con expected_version = 0", async ({
    page,
  }) => {
    await setupAuthRoutes(page);

    const putCalls: Array<{ expected_version: number; idempotency_key?: string }> = [];

    await page.route("**/api/v1/kiln-batches/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BATCH),
      });
    });

    let savedLayout: typeof MOCK_LAYOUT | null = null;

    await page.route("**/api/v1/kiln-batches/1/layout", async (route) => {
      if (route.request().method() === "PUT") {
        const body = JSON.parse(route.request().postData() || "{}");
        putCalls.push(body);
        savedLayout = {
          ...MOCK_LAYOUT,
          version: 1,
          levels: body.levels,
          placements: body.placements,
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(savedLayout),
        });
      } else {
        if (savedLayout) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(savedLayout),
          });
        } else {
          await route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ detail: "NOT_FOUND" }),
          });
        }
      }
    });

    await login(page);

    await page.goto("/produccion/hornadas/1/mapa");

    // 1. Validar badge de estado inicial
    await expect(page.getByText("Sin distribución guardada")).toBeVisible();

    // 2. Añadir nivel con el modal
    const addLevelBtn = page.getByRole("button", { name: /añadir nivel/i });
    await addLevelBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/nombre o descripción del nivel/i).fill("Piso Inicial");
    await dialog.getByRole("button", { name: /añadir nivel/i }).click();

    // 3. Guardar distribución inicial
    const saveBtn = page.getByRole("button", { name: /guardar distribución/i });
    await saveBtn.click();

    // 4. Comprobar expected_version = 0 en el PUT
    await expect.poll(() => putCalls.length).toBe(1);
    expect(putCalls[0]?.expected_version).toBe(0);
    expect(putCalls[0]?.idempotency_key).toBeDefined();

    // 5. Tras guardar, debe actualizarse a versión 1
    await expect(page.getByText(/versión: 1/i)).toBeVisible();

    // 6. Recargar la página y comprobar persistencia desde el servidor
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /mapa de distribución física del horno/i }),
    ).toBeVisible();
    await expect(page.getByText(/versión: 1/i)).toBeVisible();
  });

  test("IDEMPOTENCY RETRY: fallo de red en primer PUT y reintento exitoso reutiliza la misma idempotency_key", async ({
    page,
  }) => {
    await setupAuthRoutes(page);

    let putAttempt = 0;
    const capturedKeys: string[] = [];

    await page.route("**/api/v1/kiln-batches/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BATCH),
      });
    });

    await page.route("**/api/v1/kiln-batches/1/layout", async (route) => {
      if (route.request().method() === "PUT") {
        putAttempt++;
        const body = JSON.parse(route.request().postData() || "{}");
        capturedKeys.push(body.idempotency_key);
        if (putAttempt === 1) {
          // Simular fallo de red/servidor
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ detail: "INTERNAL_SERVER_ERROR" }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...MOCK_LAYOUT,
              version: 2,
            }),
          });
        }
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_LAYOUT),
        });
      }
    });

    await login(page);
    await page.goto("/produccion/hornadas/1/mapa");

    // Seleccionar y rotar una pieza para crear cambio
    const piece = page.getByRole("button", { name: /taza de café/i }).first();
    await piece.click();
    await page.getByRole("button", { name: /rotar 90°/i }).click();

    // Primer intento de guardado (falla con 500)
    const saveBtn = page.getByRole("button", { name: /guardar distribución/i });
    await saveBtn.click();
    await expect(page.getByRole("alert")).toBeVisible();

    // Segundo intento de guardado (reintento sobre el mismo borrador)
    await saveBtn.click();
    await expect(page.getByText(/guardada exitosamente/i)).toBeVisible();

    // Verificar que ambas llamadas usaron la misma clave de idempotencia
    expect(capturedKeys.length).toBe(2);
    expect(capturedKeys[0]).toBeDefined();
    expect(capturedKeys[0]).toBe(capturedKeys[1]);
  });

  test("CONFLICTO 409: muestra modal de conflicto y permite recargar", async ({ page }) => {
    await setupAuthRoutes(page);

    await page.route("**/api/v1/kiln-batches/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BATCH),
      });
    });

    await page.route("**/api/v1/kiln-batches/1/layout", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ detail: "KILN_LAYOUT_VERSION_CONFLICT" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_LAYOUT),
        });
      }
    });

    await login(page);
    await page.goto("/produccion/hornadas/1/mapa");

    const piece = page.getByRole("button", { name: /taza de café/i }).first();
    await piece.click();
    await page.getByRole("button", { name: /rotar 90°/i }).click();

    const saveBtn = page.getByRole("button", { name: /guardar distribución/i });
    await saveBtn.click();

    // Abre el modal de conflicto
    await expect(page.getByRole("dialog", { name: /conflicto de versión/i })).toBeVisible();
    const reloadBtn = page.getByRole("button", { name: /recargar desde servidor/i });
    await expect(reloadBtn).toBeVisible();
  });

  test("SOLO LECTURA: hornada STARTED no muestra botones de guardado ni sugerencia", async ({
    page,
  }) => {
    await setupAuthRoutes(page);

    const startedBatch = { ...MOCK_BATCH, status: "STARTED" };

    await page.route("**/api/v1/kiln-batches/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(startedBatch),
      });
    });

    await page.route("**/api/v1/kiln-batches/1/layout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_LAYOUT),
      });
    });

    await login(page);
    await page.goto("/produccion/hornadas/1/mapa");

    // Badge solo lectura
    await expect(page.getByText(/solo lectura/i)).toBeVisible();

    // Botones de acción ausentes
    await expect(page.getByRole("button", { name: /sugerir acomodo/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /guardar distribución/i })).not.toBeVisible();
  });

  test("PRIVACIDAD COMERCIAL: no renderiza ningún campo de precio, costo, IGV o margen", async ({
    page,
  }) => {
    await setupAuthRoutes(page);

    await page.route("**/api/v1/kiln-batches/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BATCH),
      });
    });

    await page.route("**/api/v1/kiln-batches/1/layout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_LAYOUT),
      });
    });

    await login(page);
    await page.goto("/produccion/hornadas/1/mapa");

    await expect(
      page.getByRole("heading", { name: /mapa de distribución física del horno/i }),
    ).toBeVisible();

    await expect(page.getByText(/s\/\./i)).not.toBeVisible();
    await expect(page.getByText(/subtotal/i)).not.toBeVisible();
    await expect(page.getByText(/igv/i)).not.toBeVisible();
    await expect(page.getByText(/margen/i)).not.toBeVisible();
  });

  test("MISSING_DIMENSIONS: horno sin medidas válidas -> alerta de bloqueo, sin SVG y controles deshabilitados", async ({
    page,
  }) => {
    await setupAuthRoutes(page);

    const batchWithoutDims = {
      ...MOCK_BATCH,
      kiln_width_cm_snapshot: "0.000000",
      kiln_depth_cm_snapshot: "0.000000",
      kiln_height_cm_snapshot: "0.000000",
    };

    await page.route("**/api/v1/kiln-batches/1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(batchWithoutDims),
      });
    });

    await page.route("**/api/v1/kiln-batches/1/layout", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "NOT_FOUND" }),
      });
    });

    await login(page);
    await page.goto("/produccion/hornadas/1/mapa");

    // 1. Debe mostrar alerta accesible de dimensiones faltantes
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(
      "No se puede crear la distribución porque este horno no tiene ancho, fondo y altura útil configurados",
    );

    // 2. NO debe renderizarse el SVG interactivo
    await expect(page.getByRole("region", { name: /plano interactivo/i })).not.toBeVisible();
    await expect(page.getByRole("region", { name: /lienzo bloqueado/i })).toBeVisible();
    await expect(
      page.getByText(/Lienzo físico bloqueado hasta configurar las dimensiones del horno/i),
    ).toBeVisible();

    // 3. Controles de acción deshabilitados
    await expect(page.getByRole("button", { name: /sugerir acomodo/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: /añadir nivel/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: /guardar distribución/i })).toBeDisabled();
  });
});
