import { useState } from "react";

import { DecimalField } from "@/components/DecimalField";
import { PrimaryButton, SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import { formatCosto, MONEDA_BASE } from "@/features/cotizadorV2/moneda";
import { currencySymbol } from "@/features/quotations/money";
import { useEsperarGuardado } from "@/features/cotizadorV2/claves";
import { useV2QuotationProducts } from "@/features/cotizadorV2/useQuoterV2Materials";
import {
  useAddV2QuotationExtra,
  useDeleteV2QuotationExtra,
  useUpdateV2QuotationExtra,
  useV2Extras,
  useV2QuotationExtras,
} from "@/features/cotizadorV2/useQuoterV2Processes";

const SIN_SELECCION = "";
const TODO_EL_PEDIDO = "";

/**
 * Adicionales de la cotización: empaque especial, molde, sello (corrección 010H).
 *
 * Están en el Excel aprobado desde el principio —hoja «Cotizador V2», «Otros
 * extras»— y suman al Costo de Producción Y al Costo Real. En V2 no existían:
 * no había dónde ponerlos, y acababan escondidos en el precio o disfrazados de
 * material.
 *
 * ## Por qué viven aquí y no en Mano de obra
 *
 * Un adicional no tiene rendimiento ni horas de nadie, y no se consume del
 * inventario. Mezclarlo con las técnicas es lo que produce el doble cobro: el
 * asa cobrada como proceso y otra vez como «adicional armado de asa».
 *
 * El precio nace del maestro y se puede pactar otro para esta cotización. Lo
 * que se congela es lo pactado: subir mañana el maestro no cambia una
 * cotización ya entregada.
 */
export function V2ExtrasPanel({
  quotationId,
  canEdit,
}: {
  quotationId: number;
  canEdit: boolean;
}) {
  const query = useV2QuotationExtras(quotationId);
  const maestro = useV2Extras(true);
  const productos = useV2QuotationProducts(quotationId);
  const anadir = useAddV2QuotationExtra(quotationId);
  const actualizar = useUpdateV2QuotationExtra(quotationId);
  const borrar = useDeleteV2QuotationExtra(quotationId);
  const esperarGuardado = useEsperarGuardado(quotationId);

  const [concepto, setConcepto] = useState(SIN_SELECCION);
  const [linea, setLinea] = useState(TODO_EL_PEDIDO);

  if (query.isPending) return <Spinner className="size-5" label="Cargando adicionales..." />;
  if (query.isError) {
    return (
      <p role="alert" className="text-xs text-red-600">
        {describeError(query.error)}
      </p>
    );
  }

  const pagina = query.data;
  const conceptos = maestro.data?.items ?? [];
  const lineas = productos.data?.items ?? [];
  const nombreDeLinea = (id: number | null) =>
    id === null ? "Todo el pedido" : (lineas.find((fila) => fila.id === id)?.product_name ?? `Línea ${id}`);

  return (
    <section
      data-testid="adicionales"
      className="mt-4 rounded-2xl border border-black/[0.06] bg-white/60 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">
          Adicionales{" "}
          <span className="font-normal text-zinc-500">(empaque, moldes, sellos)</span>
        </h3>
        <span className="text-xs text-zinc-600">
          Suman <strong className="tabular-nums">{formatCosto(pagina.extras_cost_total)}</strong> al
          costo
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        No son material ni técnica: son un costo que se decide, y entran tanto en el costo de
        producción como en el costo real. Salen del catálogo; el costo se puede pactar aquí.
      </p>

      {pagina.items.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">Esta cotización no lleva adicionales.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {pagina.items.map((fila) => (
            <li
              key={fila.id}
              className="grid grid-cols-1 items-start gap-3 rounded-xl border border-black/[0.06] bg-white/70 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_9rem_auto]"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-zinc-900">{fila.name_snapshot}</p>
                <p className="text-[11.5px] text-zinc-500">
                  {nombreDeLinea(fila.v2_quotation_product_id)} · por {fila.unit_snapshot}
                </p>
                <p className="mt-1 text-[13px] tabular-nums text-zinc-900">
                  Total: <strong>{formatCosto(fila.total_cost)}</strong>
                </p>
              </div>
              {canEdit ? (
                <>
                  <DecimalField
                    label="Cantidad"
                    value={fila.quantity}
                    sufijo={fila.unit_snapshot}
                    onCommit={(valor) =>
                      valor !== null
                        ? esperarGuardado(actualizar, "adicional-editar", {
                            extraId: fila.id,
                            payload: { quantity: valor },
                          })
                        : undefined
                    }
                  />
                  <DecimalField
                    label="Costo unitario"
                    value={fila.unit_cost_snapshot}
                    sufijo={currencySymbol(MONEDA_BASE)}
                    onCommit={(valor) =>
                      valor !== null
                        ? esperarGuardado(actualizar, "adicional-editar", {
                            extraId: fila.id,
                            payload: { unit_cost: valor },
                          })
                        : undefined
                    }
                    hint={fila.unit_cost_is_override ? "Pactado aquí" : "Del catálogo"}
                  />
                  <button
                    type="button"
                    onClick={() => borrar.mutate(fila.id)}
                    disabled={borrar.isPending}
                    aria-label={`Quitar ${fila.name_snapshot}`}
                    className="self-center justify-self-start rounded-lg px-2 py-1 text-xs font-semibold text-red-700 underline underline-offset-2 hover:bg-red-50 cursor-pointer disabled:opacity-40 sm:justify-self-end"
                  >
                    Quitar
                  </button>
                </>
              ) : (
                <dl className="grid grid-cols-2 gap-3 text-[13px] sm:col-span-3">
                  <div>
                    <dt className="text-xs text-zinc-500">Cantidad</dt>
                    <dd className="tabular-nums">
                      {fila.quantity} {fila.unit_snapshot}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Costo unitario</dt>
                    <dd className="tabular-nums">{formatCosto(fila.unit_cost_snapshot)}</dd>
                  </div>
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        conceptos.length === 0 ? (
          <p
            data-testid="sin-conceptos-adicionales"
            role="status"
            className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
          >
            No hay conceptos adicionales en el catálogo. Se dan de alta en Configuración → Cotizador
            V2.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-black/[0.04] pt-3">
            <SelectField
              label="Añadir adicional"
              requirement="optional"
              value={concepto}
              options={[
                { value: SIN_SELECCION, label: "Seleccionar..." },
                ...conceptos.map((uno) => ({
                  value: String(uno.id),
                  label: `${uno.name} · ${formatCosto(uno.unit_cost)} / ${uno.unit}`,
                })),
              ]}
              onChange={setConcepto}
              className="min-w-0 flex-1 sm:max-w-xs"
            />
            <SelectField
              label="Se aplica a"
              requirement="optional"
              value={linea}
              options={[
                { value: TODO_EL_PEDIDO, label: "Todo el pedido" },
                ...lineas.map((fila) => ({
                  value: String(fila.id),
                  label: fila.product_name ?? `Línea ${fila.id}`,
                })),
              ]}
              onChange={setLinea}
              className="min-w-0 flex-1 sm:max-w-xs"
            />
            <PrimaryButton
              type="button"
              disabled={concepto === SIN_SELECCION || anadir.isPending}
              onClick={() =>
                anadir.mutate(
                  {
                    v2_extra_id: Number(concepto),
                    v2_quotation_product_id: linea === TODO_EL_PEDIDO ? null : Number(linea),
                    quantity: "1",
                  },
                  { onSuccess: () => setConcepto(SIN_SELECCION) },
                )
              }
            >
              {anadir.isPending ? "Añadiendo..." : "Añadir"}
            </PrimaryButton>
          </div>
        )
      ) : null}

      {anadir.isError || actualizar.isError || borrar.isError ? (
        <p role="alert" className="mt-3 text-xs text-red-600">
          {describeError(anadir.error ?? actualizar.error ?? borrar.error)}
        </p>
      ) : null}
    </section>
  );
}
