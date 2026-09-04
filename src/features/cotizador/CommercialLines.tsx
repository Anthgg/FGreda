/**
 * Cargos comerciales de la cotización: conceptos que se cobran y no se
 * fabrican.
 *
 * Todo lo monetario derivado —IGV, redondeo, conversión de moneda, totales—
 * llega calculado del backend y aquí sólo se muestra. Lo único que esta
 * pantalla envía es el importe NETO que teclea una persona, y ya en la moneda
 * de emisión: quien escribe 200 cotizando en dólares quiere cobrar doscientos
 * dólares, no doscientos soles convertidos.
 */

import { useState } from "react";

import { PrimaryButton, SecondaryButton, TextField } from "@/components/form";
import {
  useAddCommercialLine,
  useDeleteCommercialLine,
  useUpdateCommercialLine,
} from "@/features/cotizador/useCotizador";
import { describeError } from "@/features/settings/messages";
import { formatMoney } from "@/features/quotations/money";
import type { CommercialLineOut } from "@/types/quotationBuilder";

interface CommercialLinesProps {
  quotationId: number | null;
  lines: CommercialLineOut[];
  currencyCode: string | null;
  /** Sólo un borrador admite cambios. Confirmada es un documento entregado. */
  editable: boolean;
}

export function CommercialLines({
  quotationId,
  lines,
  currencyCode,
  editable,
}: CommercialLinesProps) {
  const [descripcion, setDescripcion] = useState("");
  const [importe, setImporte] = useState("");
  const [editando, setEditando] = useState<number | null>(null);

  const anadir = useAddCommercialLine(quotationId ?? 0);
  const actualizar = useUpdateCommercialLine(quotationId ?? 0);
  const borrar = useDeleteCommercialLine(quotationId ?? 0);
  const ocupado = anadir.isPending || actualizar.isPending || borrar.isPending;
  const error = anadir.error ?? actualizar.error ?? borrar.error;

  // Sin cotización guardada no hay dónde colgar un cargo: el borrador todavía
  // no existe en el servidor.
  if (quotationId === null) return null;

  const limpiar = () => {
    setDescripcion("");
    setImporte("");
    setEditando(null);
  };

  const guardar = () => {
    const payload = {
      kind: "PROTOTYPE" as const,
      description: descripcion.trim(),
      quantity: 1,
      manual_net_amount: importe.trim(),
    };
    if (editando === null) {
      anadir.mutate(payload, { onSuccess: limpiar });
    } else {
      actualizar.mutate({ lineId: editando, payload }, { onSuccess: limpiar });
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-3">
        <p className="text-xs font-semibold text-zinc-900">Cargos comerciales</p>
        <p className="text-[11px] text-zinc-600">
          Conceptos que se cobran y no se fabrican, como una muestra. Suman al subtotal sin pasar
          por el factor de producción ni por el margen del producto.
        </p>
      </div>

      {lines.length === 0 ? (
        <p className="text-xs text-zinc-400">Esta cotización no tiene cargos.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {lines.map((line) => (
            <li key={line.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-900">{line.description}</p>
                {/* El importe mostrado es el que devolvió el backend, no uno
                    recompuesto aquí. */}
                <p className="text-[11px] text-zinc-500">
                  {formatMoney(line.manual_net_amount, currencyCode)} netos · total{" "}
                  {formatMoney(line.line_total_gross, currencyCode)}
                </p>
              </div>
              {editable ? (
                <div className="flex shrink-0 gap-2">
                  <SecondaryButton
                    type="button"
                    disabled={ocupado}
                    onClick={() => {
                      setEditando(line.id);
                      setDescripcion(line.description);
                      setImporte(line.manual_net_amount);
                    }}
                  >
                    Editar
                  </SecondaryButton>
                  <SecondaryButton
                    type="button"
                    className="border-red-200 text-red-700"
                    disabled={ocupado}
                    onClick={() => borrar.mutate(line.id)}
                  >
                    Quitar
                  </SecondaryButton>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <TextField
            label="Concepto"
            requirement="required"
            value={descripcion}
            onChange={setDescripcion}
            disabled={ocupado}
            placeholder="Ej. Prototipo PRT-2026-000007"
          />
          <TextField
            label={`Importe neto${currencyCode ? ` (${currencyCode})` : ""}`}
            requirement="required"
            value={importe}
            onChange={setImporte}
            disabled={ocupado}
            inputMode="decimal"
            placeholder="Ej. 200"
            hint="Sin IGV. El impuesto y el redondeo los calcula BGreda."
          />
          <div className="flex gap-2">
            <PrimaryButton
              type="button"
              disabled={ocupado || !descripcion.trim() || !importe.trim()}
              onClick={guardar}
            >
              {editando === null ? "Añadir" : "Guardar"}
            </PrimaryButton>
            {editando !== null ? (
              <SecondaryButton type="button" disabled={ocupado} onClick={limpiar}>
                Cancelar
              </SecondaryButton>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-900">{describeError(error)}</p>
      ) : null}
    </div>
  );
}
