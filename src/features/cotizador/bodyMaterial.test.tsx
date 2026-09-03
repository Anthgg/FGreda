/**
 * El Cotizador pide MATERIAL, no receta.
 *
 * Lo que se protege aquí es lo que el usuario ve y lo que el navegador manda.
 * La pantalla tiene que hablar de barbotina y de gramos por pieza, no de
 * fórmulas; y el cliente tiene que seguir sin calcular nada: la unidad, el
 * requerimiento total y el costo llegan resueltos del backend.
 */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CotizadorItemCard } from "@/features/cotizador/CotizadorItemCard";
import { emptyCotizadorItem } from "@/features/cotizador/draft";
import type { CotizadorItemDraft } from "@/features/cotizador/draft";
import {
  csrfResponse,
  errorResponse,
  jsonResponse,
  mockFetch,
  renderWithProviders,
  sessionResponse,
} from "@/test/utils";
import type { BodyMaterialOptionPage, QuotationBuilderItemOut } from "@/types/quotationBuilder";

const MATERIALS: BodyMaterialOptionPage = {
  items: [
    {
      product_id: 70,
      internal_reference: "LAB70005",
      name: "BARBOTINA BLANCA",
      product_type: "PREPARED_MATERIAL",
      source: "PREPARED",
      uom: "g",
      recipe_name: "Barbotina blanca v3",
      costable: true,
    },
    {
      product_id: 71,
      internal_reference: "LAB60001",
      name: "ARCILLA POTTER",
      product_type: "RAW_MATERIAL",
      source: "RAW",
      uom: "g",
      recipe_name: null,
      costable: true,
    },
  ],
  total: 2,
};

function mockApi() {
  return mockFetch((url) => {
    if (url.includes("/auth/csrf")) return csrfResponse();
    if (url.includes("/auth/me")) return sessionResponse();
    if (url.includes("/quotation-builder/body-materials")) return jsonResponse(200, MATERIALS);
    if (url.includes("/firing-lines")) return jsonResponse(200, { items: [], total: 0 });
    if (url.includes("/techniques") || url.includes("/additionals")) {
      return jsonResponse(200, { items: [], total: 0 });
    }
    return errorResponse(404, "NOT_FOUND");
  });
}

function renderCard(
  item: Partial<CotizadorItemDraft> = {},
  preview?: Partial<QuotationBuilderItemOut>,
) {
  const onChange = vi.fn();
  renderWithProviders(
    <CotizadorItemCard
      item={{ ...emptyCotizadorItem(), productId: "42", productLabel: "Jarra", ...item }}
      index={0}
      mode="PRODUCTION"
      {...(preview ? { preview: preview as QuotationBuilderItemOut } : {})}
      disabled={false}
      excludedProductIds={[]}
      onChange={onChange}
      onRemove={vi.fn()}
    />,
  );
  return onChange;
}

describe("Cotizador · material base de la pieza", () => {
  it("BODY_MATERIAL_LABEL_CORRECT: la pantalla habla de material, no de receta", () => {
    mockApi();
    renderCard();

    expect(screen.getByText("Material base de la pieza")).toBeInTheDocument();
    expect(screen.getByLabelText("Material")).toBeInTheDocument();
    expect(screen.getByLabelText(/Cantidad de material por pieza/)).toBeInTheDocument();
  });

  it("RECIPE_NOT_PRIMARY_QUOTE_INPUT: ya no hay selector de receta ni gramos de receta", () => {
    // Es el defecto que abrió esta corrección: la pieza se expresaba con la
    // fórmula del material en vez de con el material.
    mockApi();
    renderCard();

    expect(screen.queryByLabelText("Receta")).not.toBeInTheDocument();
    expect(screen.queryByText(/Gramos de receta por pieza/)).not.toBeInTheDocument();
  });

  it("BODY_MATERIAL_SELECT: el selector muestra código y nombre del material", async () => {
    const user = userEvent.setup();
    mockApi();
    const onChange = renderCard();

    await user.click(screen.getByRole("combobox", { name: "Material" }));
    await user.click(await screen.findByText("LAB70005 · BARBOTINA BLANCA"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyMaterialId: "70",
        bodyMaterialLabel: "LAB70005 · BARBOTINA BLANCA",
        bodyMaterialUom: "g",
        bodyMaterialRecipeName: "Barbotina blanca v3",
      }),
    );
  });

  it("BODY_MATERIAL_UOM_CANONICAL: la unidad se muestra, no se elige", () => {
    // No hay ningún control para cambiarla: viene de la ficha del material.
    mockApi();
    renderCard({ bodyMaterialId: "70", bodyMaterialQuantityPerPiece: "300" }, {
      body_material: {
        product_id: 70,
        product_internal_reference: "LAB70005",
        product_name: "BARBOTINA BLANCA",
        product_type: "PREPARED_MATERIAL",
        quantity_per_piece: "300.000000",
        uom: "g",
        source: "PREPARED",
        recipe_id_used: 3,
        recipe_version_id_used: 5,
        recipe_name_snapshot: "Barbotina blanca v3",
        unit_cost_snapshot: "0.0123",
        required_quantity: "3600.000000",
        material_cost: "44.28",
      },
      warnings: [],
    });

    expect(screen.getByText("Unidad")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Unidad" })).not.toBeInTheDocument();
    // FRONT_MATERIAL_REQUIREMENT_AUTHORITY: 3600 llega calculado. Aquí no se
    // multiplica 300 por 12 ni por nada.
    expect(screen.getByText(/Necesita 3600\.000000 g en total/)).toBeInTheDocument();
  });

  it("la receta se muestra como procedencia y de sólo lectura", () => {
    // RECIPE_REMAINS_PREPARATION_DOMAIN: informa de dónde salió la barbotina,
    // sin pedirle a nadie que la elija.
    mockApi();
    renderCard({
      bodyMaterialId: "70",
      bodyMaterialUom: "g",
      bodyMaterialRecipeName: "Barbotina blanca v3",
    });

    expect(screen.getByText(/Preparado mediante:/)).toBeInTheDocument();
    expect(screen.getByText("Barbotina blanca v3")).toBeInTheDocument();
    // Y no es un control: no se puede elegir otra desde aquí.
    expect(screen.queryByRole("combobox", { name: /Receta/i })).not.toBeInTheDocument();
  });

  it("una materia prima directa no anuncia ninguna procedencia", async () => {
    const user = userEvent.setup();
    mockApi();
    const onChange = renderCard();

    await user.click(screen.getByRole("combobox", { name: "Material" }));
    await user.click(await screen.findByText("LAB60001 · ARCILLA POTTER"));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bodyMaterialId: "71", bodyMaterialRecipeName: "" }),
    );
  });

  it("GLAZE_REMAINS_ADDITIONAL + FIRING_REMAINS_SEPARATE: tres bloques distintos", () => {
    // El cuerpo, el acabado y la quema se leen por separado. Mezclarlos fue
    // justamente lo que hizo que el material del cuerpo pareciera una receta.
    mockApi();
    renderCard();

    expect(screen.getByText("Material base de la pieza")).toBeInTheDocument();
    expect(screen.getByText(/Esmaltes de la pieza/)).toBeInTheDocument();
    expect(screen.getByText("Ruta de quema de esta pieza")).toBeInTheDocument();
  });
});
