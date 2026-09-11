import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchProducts } from "@/api/masters";
import { FormSection, SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import { useUpsertV2Material, useV2Materials } from "@/features/cotizadorV2/useQuoterV2Materials";
import type { Product, ProductType } from "@/types/masters";
import {
  MATERIAL_KIND_LABEL,
  MATERIAL_ORIGIN_LABEL,
  type V2Material,
  type V2MaterialKind,
  type V2MaterialOrigin,
  type V2MaterialUpsertInput,
} from "@/types/quoterV2Materials";

/**
 * Valorización de materiales para el Cotizador V2.
 *
 * Aquí se dice, material por material, **cuánto costó traerlo** —cuánto se
 * compró, por cuánto y cuánto costó el transporte— y de ahí sale el costo por
 * gramo con el que se cotiza. El transporte entra en el costo: sin él, una
 * arcilla de S/100 más S/30 de flete se cotizaría un 23 % por debajo de lo que
 * de verdad cuesta, en cada gramo de cada pieza.
 *
 * Dos decisiones que esta pantalla mantiene separadas a propósito:
 *
 * - el costo **derivado** de la compra lo calcula la base de datos y aquí solo
 *   se lee. Si se pudiera escribir, sería un segundo número capaz de
 *   contradecir a sus propios operandos;
 * - la **valorización manual** es otra cosa: un material donado costó cero y
 *   aun así vale lo que vale. Es una decisión, se escribe a mano y no toca lo
 *   que se pagó.
 *
 * La lista la manda el maestro de productos —esta pantalla no inventa
 * materiales, ni tiene una lista fija de nombres— y el stock se muestra
 * únicamente para avisar: un material sin existencia se cotiza igual.
 */

const CANDIDATE_TYPES: readonly ProductType[] = ["RAW_MATERIAL", "PREPARED_MATERIAL"];

const KIND_OPTIONS = (Object.keys(MATERIAL_KIND_LABEL) as V2MaterialKind[]).map((value) => ({
  value,
  label: MATERIAL_KIND_LABEL[value],
}));

const ORIGIN_OPTIONS = (Object.keys(MATERIAL_ORIGIN_LABEL) as V2MaterialOrigin[]).map((value) => ({
  value,
  label: MATERIAL_ORIGIN_LABEL[value],
}));

type Draft = {
  material_kind: string;
  origin: string;
  purchase_quantity: string;
  purchase_cost: string;
  transport_cost: string;
  costing_override_per_unit: string;
  ml_per_gram: string;
};

const NUEVO: Draft = {
  material_kind: "BODY",
  origin: "PURCHASE",
  purchase_quantity: "",
  purchase_cost: "",
  transport_cost: "0",
  costing_override_per_unit: "",
  ml_per_gram: "",
};

function toDraft(material: V2Material): Draft {
  return {
    material_kind: material.material_kind,
    origin: material.origin,
    purchase_quantity: material.purchase_quantity,
    purchase_cost: material.purchase_cost,
    transport_cost: material.transport_cost,
    costing_override_per_unit: material.costing_override_per_unit ?? "",
    ml_per_gram: material.ml_per_gram ?? "",
  };
}

/**
 * Validación de experiencia de usuario. El backend la repite entera.
 *
 * Un campo vacío NO es un cero: `Number("")` da 0 y pasaría cualquier
 * comprobación de «>= 0», enviando una cadena vacía que el backend rechaza con
 * un 422 que el usuario no esperaba.
 */
function validateMaterial(draft: Draft): string | null {
  const cantidad = draft.purchase_quantity.trim();
  const compra = draft.purchase_cost.trim();
  if (cantidad === "" || Number.isNaN(Number(cantidad)) || !(Number(cantidad) > 0)) {
    return "Indique cuánto se compró. Sin cantidad no hay costo por gramo.";
  }
  if (compra === "" || Number.isNaN(Number(compra)) || Number(compra) < 0) {
    return "Indique cuánto costó la compra.";
  }
  const transporte = draft.transport_cost.trim();
  if (transporte !== "" && (Number.isNaN(Number(transporte)) || Number(transporte) < 0)) {
    return "El transporte no puede ser negativo.";
  }
  const manual = draft.costing_override_per_unit.trim();
  if (manual !== "" && (Number.isNaN(Number(manual)) || Number(manual) < 0)) {
    return "La valorización manual no puede ser negativa.";
  }
  const conversion = draft.ml_per_gram.trim();
  if (conversion !== "" && (Number.isNaN(Number(conversion)) || !(Number(conversion) > 0))) {
    return "La conversión g/ml tiene que ser mayor que cero.";
  }
  return null;
}

function toPayload(draft: Draft): V2MaterialUpsertInput {
  // Vacío significa «no hay decisión», y eso se manda como `null`, no como "".
  const opcional = (valor: string) => (valor.trim() === "" ? null : valor.trim());
  return {
    material_kind: draft.material_kind as V2MaterialKind,
    origin: draft.origin as V2MaterialOrigin,
    purchase_quantity: draft.purchase_quantity.trim(),
    purchase_cost: draft.purchase_cost.trim(),
    transport_cost: draft.transport_cost.trim() === "" ? "0" : draft.transport_cost.trim(),
    costing_override_per_unit: opcional(draft.costing_override_per_unit),
    ml_per_gram: opcional(draft.ml_per_gram),
  };
}

function Campo({
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  disabled: boolean;
  hint?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="text-zinc-500">{label}</span>
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        inputMode="decimal"
        className="mt-1 w-full rounded-lg border border-black/10 px-2 py-1"
      />
      {hint ? <span className="mt-1 block text-[11px] text-zinc-500">{hint}</span> : null}
    </label>
  );
}

function Editor({
  producto,
  draft,
  setDraft,
  onCancel,
  onSave,
  guardando,
  error,
}: {
  producto: Product;
  draft: Draft;
  setDraft: (draft: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  guardando: boolean;
  error: string | null;
}) {
  const set = (campo: keyof Draft) => (valor: string) => setDraft({ ...draft, [campo]: valor });
  const unidad = producto.base_uom_code ?? "unidad base";

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4">
      <h4 className="text-sm font-semibold text-zinc-900">Valorizar {producto.name}</h4>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectField
          label="Tipo de material"
          requirement="required"
          value={draft.material_kind as V2MaterialKind}
          options={KIND_OPTIONS}
          onChange={set("material_kind")}
          disabled={guardando}
          hint="Pasta o esmalte. No se deduce del nombre del material."
        />
        <SelectField
          label="Procedencia"
          requirement="required"
          value={draft.origin as V2MaterialOrigin}
          options={ORIGIN_OPTIONS}
          onChange={set("origin")}
          disabled={guardando}
        />
        <Campo
          label={`Cantidad comprada (${unidad})`}
          value={draft.purchase_quantity}
          onChange={set("purchase_quantity")}
          disabled={guardando}
        />
        <Campo
          label="Costo de la compra"
          value={draft.purchase_cost}
          onChange={set("purchase_cost")}
          disabled={guardando}
        />
        <Campo
          label="Transporte"
          value={draft.transport_cost}
          onChange={set("transport_cost")}
          disabled={guardando}
          hint="Entra en el costo del material: traerlo es parte de lo que cuesta."
        />
        <Campo
          label="Valorización manual por unidad"
          value={draft.costing_override_per_unit}
          onChange={set("costing_override_per_unit")}
          disabled={guardando}
          hint="Solo si lo que vale no es lo que se pagó: material donado, por ejemplo. Vacío = se deriva de la compra."
        />
        <Campo
          label="Conversión ml por gramo"
          value={draft.ml_per_gram}
          onChange={set("ml_per_gram")}
          disabled={guardando}
          hint="Vacío: se usa 1 g = 1 ml y la cotización lo dice."
        />
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={guardando}
          className="text-xs font-semibold text-zinc-900 underline underline-offset-2 cursor-pointer disabled:opacity-40"
        >
          {guardando ? "Guardando..." : "Guardar valorización"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={guardando}
          className="text-xs font-semibold text-zinc-500 underline underline-offset-2 cursor-pointer disabled:opacity-40"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function V2MaterialsTable({ canEdit }: { canEdit: boolean }) {
  const valorizados = useV2Materials();
  const guardar = useUpsertV2Material();
  const [editando, setEditando] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(NUEVO);
  const [error, setError] = useState<string | null>(null);

  // Dos consultas y no una: el filtro del maestro es de un solo tipo, y traer
  // TODOS los productos activos para descartar en el navegador movería miles
  // de filas para mostrar decenas.
  const candidatos = useQuery({
    queryKey: ["quoter-v2", "material-candidates"],
    queryFn: async () => {
      const paginas = await Promise.all(
        CANDIDATE_TYPES.map((product_type) =>
          fetchProducts({ product_type, active: true, limit: 200 }),
        ),
      );
      return paginas.flatMap((pagina) => pagina.items);
    },
  });

  if (candidatos.isPending || valorizados.isPending) {
    return <Spinner className="size-5" label="Cargando materiales..." />;
  }
  if (candidatos.isError || valorizados.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {describeError(candidatos.error ?? valorizados.error)}
      </div>
    );
  }

  const porProducto = new Map<number, V2Material>(
    (valorizados.data?.items ?? []).map((material) => [material.product_id, material]),
  );
  const productos = [...(candidatos.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  const empezar = (producto: Product) => {
    const material = porProducto.get(producto.id);
    setDraft(material ? toDraft(material) : NUEVO);
    setError(null);
    setEditando(producto.id);
  };

  const enviar = (productId: number) => {
    const problema = validateMaterial(draft);
    setError(problema);
    if (problema) return;
    guardar.mutate(
      { productId, payload: toPayload(draft) },
      {
        onSuccess: () => setEditando(null),
        onError: (fallo) => setError(describeError(fallo)),
      },
    );
  };

  return (
    <FormSection
      title="Materiales"
      description="Cuánto costó cada material —transporte incluido— y con qué costo por unidad se cotiza."
    >
      <div className="sm:col-span-2 space-y-4">
        <p className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 text-xs text-zinc-600">
          Valorizar un material cambia lo que se cotice <strong>a partir de ahora</strong>. Las
          cotizaciones ya hechas guardaron su copia y no se recalculan. El stock se muestra para
          avisar: un material sin existencia se cotiza igual.
        </p>

        {productos.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No hay materias primas ni preparados activos en el maestro. Dé uno de alta en Productos
            y aquí podrá valorizarlo.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Material</th>
                  <th className="py-2 pr-3 font-semibold">Tipo</th>
                  <th className="py-2 pr-3 font-semibold">Adquisición</th>
                  <th className="py-2 pr-3 font-semibold">Costo por unidad</th>
                  <th className="py-2 pr-3 font-semibold">Stock</th>
                  {canEdit ? <th className="py-2 font-semibold" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {productos.map((producto) => {
                  const material = porProducto.get(producto.id);
                  return (
                    <tr key={producto.id}>
                      <td className="py-2 pr-3 text-zinc-800">
                        {producto.name}
                        {producto.base_uom_code ? (
                          <span className="text-zinc-400"> ({producto.base_uom_code})</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-zinc-600">
                        {material ? MATERIAL_KIND_LABEL[material.material_kind] : "—"}
                      </td>
                      <td className="py-2 pr-3 text-zinc-600">
                        {material ? material.acquisition_total_cost : "—"}
                      </td>
                      <td className="py-2 pr-3 text-zinc-800">
                        {material ? (
                          <>
                            {material.effective_cost_per_unit}
                            {material.costing_override_per_unit !== null ? (
                              <span className="block text-[11px] text-amber-700">
                                Valorización manual
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-zinc-400">sin valorizar</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-zinc-600">
                        {material ? material.stock : "—"}
                      </td>
                      {canEdit ? (
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => empezar(producto)}
                            className="text-xs font-semibold text-zinc-700 underline underline-offset-2 cursor-pointer"
                          >
                            {material ? "Editar valorización" : "Valorizar"}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {editando !== null
          ? (() => {
              const producto = productos.find((candidato) => candidato.id === editando);
              if (!producto) return null;
              return (
                <Editor
                  producto={producto}
                  draft={draft}
                  setDraft={setDraft}
                  onCancel={() => setEditando(null)}
                  onSave={() => enviar(producto.id)}
                  guardando={guardar.isPending}
                  error={error}
                />
              );
            })()
          : null}

        {!canEdit ? (
          <p className="text-xs text-zinc-500">
            Solo un administrador puede valorizar materiales.
          </p>
        ) : null}
      </div>
    </FormSection>
  );
}
