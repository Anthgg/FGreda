import { DecimalField } from "@/components/DecimalField";
import { Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import { useUpdateFiringQuotation } from "@/features/soloQuema/useSoloQuema";
import {
  FIRING_QUOTATION_WARNING_LABEL,
  type V2FiringQuotation,
} from "@/types/firingQuotationV2";

/**
 * Factor, precio y la lectura INTERNA del servicio. Fase 010K.
 *
 * ## El factor de Solo Quema no es el de fabricación
 *
 * Va de ×1,00 a ×2,00 y nace en ×1,00. En el Cotizador V2 el factor cubre pasta,
 * mermas, torno y el riesgo de una pieza que se raja en el horno; aquí la pieza
 * ya existe y el riesgo es de quien la trajo. Un ×3 sobre una quema no
 * respondería a ningún costo: sería solo cobrar de más.
 *
 * Se aplica UNA vez, sobre la base. Y la base es la quema comercial más el
 * vidriado y su mano de obra: el gas NO entra, porque el gas es costo y el
 * factor multiplica precio.
 *
 * ## Dos lecturas que no se mezclan
 *
 * Lo verde es lo que el cliente pagará; lo gris es lo que al taller le cuesta.
 * Se ven juntas y separadas a la vez para poder mirar la diferencia, que es el
 * número por el que existe esta pantalla.
 */

function Importe({
  label,
  value,
  hint,
  destacado = false,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  destacado?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={destacado ? "text-base font-semibold text-zinc-900" : "text-sm text-zinc-800"}>
        {value}
      </dd>
      {hint ? <dd className="text-[11px] text-zinc-500">{hint}</dd> : null}
    </div>
  );
}

export function SQPrecioPanel({
  cotizacion,
  canEdit,
}: {
  cotizacion: V2FiringQuotation;
  canEdit: boolean;
}) {
  const guardar = useUpdateFiringQuotation(cotizacion.id);
  const bajoCosto = cotizacion.warnings.includes("V2_FQ_SELLING_BELOW_COST");

  return (
    <Panel>
      <div data-testid="panel-precio-quema">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Precio y margen</h2>
          <span className="text-xs text-zinc-500">
            Total al cliente: <strong>{cotizacion.total_amount}</strong>
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Lo de abajo a la derecha es interno: costo real, ganancia y margen no salen en el
          documento.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DecimalField
            label="Factor del servicio"
            requirement="required"
            value={cotizacion.factor}
            onCommit={(valor) => {
              if (valor === null) return;
              guardar.mutate({ factor: valor });
            }}
            disabled={!canEdit}
            hint={`Entre ${cotizacion.factor_min} y ${cotizacion.factor_max}. Se aplica una sola vez sobre la base.`}
          />
          <div className="rounded-2xl bg-black/[0.03] px-4 py-3">
            <p className="text-xs text-zinc-500">Base sobre la que actúa el factor</p>
            <p className="text-sm text-zinc-800">
              <strong>{cotizacion.base_amount}</strong>
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Quema comercial + esmalte + mano de obra de vidriado. El gas no entra: es costo, no
              precio.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
            <h3 className="text-xs font-semibold text-emerald-900">Lo que paga el cliente</h3>
            <dl className="mt-3 grid grid-cols-2 gap-4">
              <Importe label="Precio comercial" value={cotizacion.commercial_price} />
              <Importe
                label="Subtotal"
                value={cotizacion.subtotal_amount}
                hint="Ya redondeado al escalón configurado."
              />
              <Importe
                label="IGV"
                value={cotizacion.tax_amount}
                hint={
                  cotizacion.tax_percent === null
                    ? undefined
                    : `${Number(cotizacion.tax_percent)} %`
                }
              />
              <Importe label="Total" value={cotizacion.total_amount} destacado />
            </dl>
          </section>

          <section
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
            data-testid="lectura-interna"
          >
            <h3 className="text-xs font-semibold text-zinc-800">
              Lo que le cuesta al taller (interno)
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-4">
              <Importe
                label="Costo real"
                value={cotizacion.real_cost_total}
                hint="Gas + esmalte + mano de obra de vidriado."
              />
              <Importe label="Ganancia estimada" value={cotizacion.estimated_profit} />
              <Importe
                label="Margen efectivo"
                value={`${cotizacion.effective_margin_percent} %`}
                hint="Sobre el precio comercial, sin IGV."
              />
            </dl>
            {bajoCosto ? (
              <p role="alert" className="mt-3 text-xs font-medium text-red-700">
                {FIRING_QUOTATION_WARNING_LABEL.V2_FQ_SELLING_BELOW_COST} Suba el factor o revise
                las tarifas antes de emitir.
              </p>
            ) : null}
          </section>
        </div>

        {guardar.isError ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {describeError(guardar.error)}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
