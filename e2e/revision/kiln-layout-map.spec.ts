import { expect, test } from "@playwright/test";

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

test.describe("Mapa interactivo de distribución física del horno (Fase 010M - M4)", () => {
  test("navega desde hornadas al mapa físico y renderiza el viewport SVG sin datos comerciales", async ({
    page,
  }) => {
    // Interceptar llamadas a la API para asegurar que haya siempre una hornada navegable
    await page.route("**/api/v1/kiln-batches?*", async (route) => {
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

    await page.route("**/api/v1/kiln-batches/1/layout", async (route) => {
      if (route.request().method() === "PUT") {
        const body = JSON.parse(route.request().postData() || "{}");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...MOCK_LAYOUT,
            version: body.expected_version + 1,
            levels: body.levels,
            placements: body.placements,
          }),
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

    // 1. Ir al listado de hornadas
    await page.goto("/produccion/hornadas");
    await expect(page.getByRole("heading", { name: "Hornadas." })).toBeVisible();

    // 2. Hacer clic en el enlace al mapa
    const mapLink = page.getByRole("link", { name: /mapa y distribución del horno/i }).first();
    await expect(mapLink).toBeVisible();
    await mapLink.click();

    // 3. Validar URL
    await expect(page).toHaveURL(/\/produccion\/hornadas\/1\/mapa/);

    // 4. Validar cabecera operativa y SVG
    await expect(
      page.getByRole("heading", { name: /mapa de distribución física del horno/i }),
    ).toBeVisible();

    // 5. Validar dimensiones útiles del horno
    await expect(page.getByText(/60 × 50 × 80 cm/i)).toBeVisible();

    // 6. Validar que el lienzo SVG esté presente
    const svg = page.locator("svg[viewBox]");
    await expect(svg.first()).toBeVisible();

    // 7. Validar PRIVACIDAD COMERCIAL: no existan campos comerciales (precios, costos, IGV, márgenes)
    await expect(page.getByText(/s\/\./i)).not.toBeVisible();
    await expect(page.getByText(/subtotal/i)).not.toBeVisible();
    await expect(page.getByText(/igv/i)).not.toBeVisible();
    await expect(page.getByText(/margen/i)).not.toBeVisible();
  });
});
