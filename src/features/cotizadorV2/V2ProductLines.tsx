import { useState } from "react";

import { PrimaryButton, SelectField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { EmptyState, Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import {
  useAddV2QuotationProduct,
  useDeleteV2QuotationProduct,
  useUpdateV2QuotationProduct,
  useV2Materials,
  useV2QuotationProducts,
} from "@/features/cotizadorV2/useQuoterV2Materials";
import {
  WARNING_LABEL,
  type V2QuotationProduct,
} from "@/types/quoterV2Materials";

/**
 * Materiales de una cotización V2: qué pasta, cuánta, y si lleva esmalte.
 *
 * Lo que se ve aquí son **importes ya calculados por el backend**. La pantalla
 * no multiplica pesos por costos: si lo hiciera, habría dos aritméticas que
 * podrían discrepar y nadie sabría cuál manda.
 *
 * El esmalte merece una nota. Cuando nadie elige uno, el sistema propone el
 * activo más caro por gramo: pecar por arriba es recuperable —si al final se
 * usa uno más barato, el taller gana— y al revés se pierde dinero sobre un
 * precio ya comprometido. Esa propuesta es una REFERENCIA DE COSTEO, no el
 * esmalte que se usará: producción elegirá el real y el precio no cambiará por
 * eso. La pantalla lo dice con todas sus letras.
 */

const SIN_MATERIAL = "";

function Aviso({ codigo }: { codigo: string }) {
  return (
    <li className="text-xs text-amber-700">{WARNING_LABEL[codigo] ?? codigo}</li>
  );
}

function Dato({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-800">{value}</dd>
      {hint ? <dd className="text-[11px] text-zinc-500">{hint}</dd> : null}
    </div>
  );
}

function Linea({
  linea,
  quotationId,
  canEdit,
}: {
  linea: V2QuotationProduct;
  quotationId: number;
  canEdit: boolean;
}) {
  const actualizar = useUpdateV2QuotationProduct(quotationId);
  const borrar = useDeleteV2QuotationProduct(quotationId);
  const pastas = useV2Materials("BODY");

  const opcionesPasta = [
    { value: SIN_MATERIAL, label: "Sin pasta" },
    ...(pastas.data?.items ?? []).map((material) => ({
      value: String(material.product_id),
      label: material.product_name,
    })),
  ];

  const guardar = (cambios: Record<string, unknown>) =>
    actualizar.mutate({ lineId: linea.id, payload: cambios });

  return (
    <div className="rounded-2xl border border-black/[0.06] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">
          {linea.product_name ?? "Línea sin producto"}
        </h3>
        {canEdit ? (
          <button
            type="button"
            onClick={() => borrar.mutate(linea.id)}
            disabled={borrar.isPending}
            className="text-xs font-semibold text-red-700 underline underline-offset-2 cursor-pointer disabled:opacity-40"
          >
            Quitar
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextField
          label="Cantidad"
          requirement="required"
          value={String(linea.quantity)}
          onChange={(valor) => guardar({ quantity: Number(valor) || 0 })}
          disabled={!canEdit}
          inputMode="numeric"
        />
        <SelectField
          label="Pasta"
          requirement="required"
          value={linea.body_material_id ? String(linea.body_material_id) : SIN_MATERIAL}
          options={opcionesPasta}
          onChange={(valor) =>
            guardar({ body_material_id: valor === SIN_MATERIAL ? null : Number(valor) })
          }
          disabled={!canEdit}
        />
        <TextField
          label={`Pasta por pieza${linea.body_uom ? ` (${linea.body_uom})` : ""}`}
          requirement="required"
          value={linea.body_unit_weight ?? ""}
          onChange={(valor) => guardar({ body_unit_weight: valor })}
          disabled={!canEdit}
          inputMode="decimal"
          hint="La unidad la fija el maestro del material."
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato label="Costo por unidad" value={linea.body_cost_per_unit ?? "—"}
          hint={linea.body_cost_is_override ? "Ajustado en esta cotización" : undefined} />
        <Dato label="Peso total" value={linea.body_total_weight} />
        <Dato label="Costo de pasta" value={linea.body_cost} />
        <Dato label="Costo de materiales" value={String(Number(linea.body_cost) + Number(linea.glaze_cost))} />
      </dl>

      <div className="mt-4 border-t border-black/[0.04] pt-4">
        <SelectField
          label="Esmalte"
          requirement="required"
          value={linea.requires_glaze ? "SI" : "NO"}
          options={[
            { value: "NO", label: "Sin esmalte" },
            { value: "SI", label: "Con esmalte" },
          ]}
          onChange={(valor) => guardar({ requires_glaze: valor === "SI" })}
          disabled={!canEdit}
          hint="Apagado por defecto. Al apagarlo, su peso y su costo quedan en cero."
        />

        {linea.requires_glaze ? (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Dato
                label="Esmalte usado"
                value={linea.glaze_material_name ?? "—"}
                hint={
                  linea.glaze_is_reference
                    ? "Referencia de costeo: el activo más caro por gramo"
                    : "Elegido explícitamente"
                }
              />
              <Dato label="Proporción" value={`${linea.glaze_percent ?? "—"} %`} />
              <Dato label="Costo por gramo" value={linea.glaze_cost_per_unit ?? "—"} />
              <Dato label="Peso de esmalte" value={linea.glaze_total_weight} />
              <Dato
                label="Volumen"
                value={`${linea.glaze_volume_ml} ml`}
                hint={
                  linea.glaze_conversion_is_fallback
                    ? "Conversión de reserva 1 g = 1 ml: este material no declara la suya"
                    : `Conversión ${linea.glaze_ml_per_gram} ml/g`
                }
              />
              <Dato label="Costo de esmalte" value={linea.glaze_cost} />
            </dl>
            {linea.glaze_is_reference ? (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                Esto es una <strong>referencia de costeo</strong>, no el esmalte final.
                Producción elegirá el esmalte real y el precio de esta cotización no cambiará
                por eso.
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {linea.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {linea.warnings.map((codigo) => (
            <Aviso key={codigo} codigo={codigo} />
          ))}
        </ul>
      ) : null}

      {actualizar.isError ? (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {describeError(actualizar.error)}
        </p>
      ) : null}
    </div>
  );
}

export function V2ProductLines({
  quotationId,
  canEdit,
}: {
  quotationId: number;
  canEdit: boolean;
}) {
  const query = useV2QuotationProducts(quotationId);
  const anadir = useAddV2QuotationProduct(quotationId);
  const [nombre, setNombre] = useState("");

  if (query.isPending) return <Spinner className="size-5" label="Cargando materiales..." />;
  if (query.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {describeError(query.error)}
      </div>
    );
  }

  const pagina = query.data;

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">Materiales</h2>
        <span className="text-xs text-zinc-500">
          Costo de materiales: <strong>{pagina.materials_cost}</strong>
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Cotizar no descuenta inventario. El consumo ocurre en producción.
      </p>

      {pagina.items.length === 0 ? (
        <EmptyState message="Todavía no hay líneas en esta cotización." />
      ) : (
        <div className="mt-4 space-y-4">
          {pagina.items.map((linea) => (
            <Linea
              key={linea.id}
              linea={linea}
              quotationId={quotationId}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}

      {canEdit ? (
        <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-black/[0.04] pt-4">
          <TextField
            label="Nueva línea"
            requirement="optional"
            value={nombre}
            onChange={setNombre}
            placeholder="Plato palta"
            className="max-w-xs"
          />
          <PrimaryButton
            type="button"
            disabled={anadir.isPending}
            onClick={() => {
              anadir.mutate({ quantity: 0 }, { onSuccess: () => setNombre("") });
            }}
          >
            {anadir.isPending ? "Añadiendo..." : "Añadir línea"}
          </PrimaryButton>
          {anadir.isError ? (
            <span role="alert" className="text-xs text-red-600">
              {describeError(anadir.error)}
            </span>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
