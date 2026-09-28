import type { ReactNode } from "react";
import { useState } from "react";

import { Spinner } from "@/components/Spinner";
import { DecimalField } from "@/components/DecimalField";
import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import { formatPercentage } from "@/features/firings/labels";
import { V2ExtrasPanel } from "@/features/cotizadorV2/V2ExtrasPanel";
import { V2ReductionsPanel } from "@/features/cotizadorV2/V2ReductionsPanel";
import { etiquetaDeFactor } from "@/features/cotizadorV2/factor";
import { formatCosto, formatPrecio, type MonedaDeCotizacion } from "@/features/cotizadorV2/moneda";
import { esMonedaExtranjera } from "@/features/cotizadorV2/pasos";
import { useSetV2Pricing, useV2Pricing } from "@/features/cotizadorV2/useQuoterV2Pricing";
import {
  useApplyV2WholesaleDefaults,
  useDeclineV2WholesaleSuggestion,
} from "@/features/cotizadorV2/useQuoterV2Lifecycle";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";
import { CostBreakdownBar } from "@/features/cotizadorV2Next/steps/pricing/CostBreakdownBar";
import { FactorControl } from "@/features/cotizadorV2Next/steps/pricing/FactorControl";
import {
  CostAllocationTable,
  PricePerPieceTable,
} from "@/features/cotizadorV2Next/steps/pricing/PricePerPieceTable";
import { PRICING_WARNING_LABEL } from "@/types/quoterV2Pricing";

/**
 * Paso «Precio» del Cotizador V2 rediseñado. Fase 010O.10.
 *
 * Cuenta una sola historia, en el orden en que se decide un precio: lo que
 * cuesta → por cuánto se multiplica → lo que paga el cliente por cada pieza. El
 * detalle que el taller consulta de vez en cuando —costo real frente a costo
 * de producción, el reparto entre piezas, cómo bajar el precio— queda plegado.
 *
 * ## El backend es la autoridad
 *
 * Lo único que este paso DECIDE es el factor comercial, y lo manda. Todo lo
 * demás —costos, precios mínimo y objetivo, redondeo, IGV, total, margen,
 * ganancia— llega calculado de `/pricing`. No hay una sola multiplicación de
 * dinero en React: si la hubiera, habría dos aritméticas y la de aquí sería de
 * coma flotante.
 *
 * ## Dos monedas
 *
 * Costos, mínimo, objetivo, negociado y ganancia van en la moneda base del
 * taller; el precio por pieza, el subtotal, el IGV y el total, en la de la
 * cotización. En una cotización en dólares se ven los dos símbolos, y se dice.
 */

const PERDIDA = "V2_PRICING_SELLING_BELOW_REAL_COST";

function Cifra({
  etiqueta,
  valor,
  pista,
  tono,
}: {
  etiqueta: string;
  valor: string;
  pista?: string;
  tono?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{etiqueta}</dt>
      <dd className={`text-[13px] font-semibold tabular-nums ${tono ?? "text-zinc-900"}`}>
        {valor}
      </dd>
      {pista ? <dd className="text-[11.5px] text-zinc-500">{pista}</dd> : null}
    </div>
  );
}

function Desplegable({
  titulo,
  children,
  testId,
}: {
  titulo: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <details
      data-testid={testId}
      className="rounded-2xl border border-black/[0.06] bg-white/60 p-4 [&[open]>summary]:mb-3"
    >
      <summary className="cursor-pointer text-[13px] font-semibold text-zinc-700">{titulo}</summary>
      {children}
    </details>
  );
}

function formatHours(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(parsed)} h`;
}

export function V2NextPricingStep({ quotationId, canEdit, datos }: PasoDelAsistenteProps) {
  const query = useV2Pricing(quotationId);
  const guardar = useSetV2Pricing(quotationId);
  const aplicarPorMayor = useApplyV2WholesaleDefaults(quotationId);
  const mantenerMinorista = useDeclineV2WholesaleSuggestion(quotationId);
  const [wholesaleError, setWholesaleError] = useState<string | null>(null);

  if (query.isPending) return <Spinner className="size-5" label="Calculando el precio…" />;
  if (query.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {describeError(query.error)}
      </div>
    );
  }

  const precio = query.data;
  const usaReglas010P = precio.pricing_rules_version === 2;
  const moneda: MonedaDeCotizacion = datos.cotizacion ?? {
    currency_code: precio.currency_code,
    currency_symbol: null,
  };
  const perdida = precio.warnings.includes(PERDIDA);
  const sinFactor = precio.commercial_factor === null;

  return (
    <Panel>
      <div data-testid="v2next-paso-precio" className="space-y-6">
        <p className="max-w-[64ch] text-[13px] text-zinc-600">
          El precio es lo que nos cuesta hacerlo multiplicado por un factor, único para toda la
          cotización. El IGV se suma al final.
        </p>

        {precio.warnings.length > 0 ? (
          <ul
            data-testid="v2next-avisos-precio"
            className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3"
          >
            {precio.warnings.map((codigo) => (
              <li key={codigo} className="text-xs text-amber-900">
                {PRICING_WARNING_LABEL[codigo] ??
                  "Hay un aviso del cálculo del precio. Revise los pasos anteriores."}
              </li>
            ))}
          </ul>
        ) : null}

        <CostBreakdownBar precio={precio} />

        {usaReglas010P ? <section
          aria-label="Tiempo activo del pedido"
          className="rounded-xl border border-zinc-200 bg-white/70 px-4 py-3"
          data-testid="v2next-tiempo-activo"
        >
          <p className="text-xs font-medium text-zinc-500">Tiempo activo del pedido</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-zinc-950">
            {formatHours(precio.active_production_hours)}
          </p>
          <p className="text-[11px] text-zinc-500">El total usa el tramo más largo porque las piezas se trabajan en paralelo.</p>
        </section> : null}

        {usaReglas010P && precio.wholesale_suggested && !precio.wholesale_suggestion_declined ? (
          <section
            role="status"
            data-testid="v2next-wholesale-banner"
            className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4"
          >
            <div>
              <h2 className="text-sm font-semibold text-amber-950">Este pedido supera el umbral configurado.</h2>
              <p className="mt-1 text-xs text-amber-900">
                {precio.total_units} unidades · umbral {precio.wholesale_threshold ?? "—"}. La decisión es tuya.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton
                type="button"
                disabled={!canEdit || aplicarPorMayor.isPending || mantenerMinorista.isPending}
                onClick={() => {
                  setWholesaleError(null);
                  aplicarPorMayor.mutate(undefined, {
                    onError: (error) => setWholesaleError(describeError(error)),
                  });
                }}
              >
                {aplicarPorMayor.isPending ? "Aplicando…" : "Aplicar Por mayor"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                disabled={!canEdit || aplicarPorMayor.isPending || mantenerMinorista.isPending}
                onClick={() => {
                  setWholesaleError(null);
                  mantenerMinorista.mutate(undefined, {
                    onError: (error) => setWholesaleError(describeError(error)),
                  });
                }}
              >
                {mantenerMinorista.isPending ? "Guardando…" : "Mantener como minorista"}
              </SecondaryButton>
            </div>
            {aplicarPorMayor.data?.warnings.length ? (
              <ul className="space-y-1 text-xs text-amber-950">
                {aplicarPorMayor.data.warnings.map((code, index) => (
                  <li key={`${code}-${index}`}>{PRICING_WARNING_LABEL[code] ?? "Revise los avisos del pedido."}</li>
                ))}
              </ul>
            ) : null}
            {wholesaleError ? <p role="alert" className="text-xs text-red-800">{wholesaleError}</p> : null}
          </section>
        ) : null}

        {usaReglas010P ? <section className="grid gap-3 rounded-2xl border border-black/[0.06] bg-white/60 p-4 sm:grid-cols-2">
          <DecimalField
            label="Costo de espacio por hora"
            value={precio.space_cost_per_hour_override}
            disabled={!canEdit || guardar.isPending}
            sufijo="S/ por hora"
            hint={`Usando ${formatCosto(precio.effective_space_cost_per_hour)} · snapshot al crear: ${formatCosto(precio.space_cost_per_hour_snapshot)}. Vacío restaura el snapshot.`}
            onCommit={(value) => guardar.mutate({ space_cost_per_hour_override: value })}
          />
          <DecimalField
            label="Tiempo pasivo"
            value={precio.passive_time_hours}
            disabled={!canEdit || guardar.isPending}
            sufijo="h"
            hint={`Sugerencia del sistema: ${formatCosto(precio.passive_space_suggestion)}. No está incluida automáticamente en el total.`}
            onCommit={(value) => guardar.mutate({ passive_time_hours: value ?? "0" })}
          />
          {guardar.isError ? (
            <p role="alert" className="sm:col-span-2 text-xs text-red-700">
              No se pudo guardar el cambio de precio: {describeError(guardar.error)}
            </p>
          ) : null}
        </section> : null}

        <Desplegable titulo="Costo comercial, costo real y quema">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Cifra
              etiqueta="Costo real"
              valor={formatCosto(precio.real_cost)}
              pista="Lo que de verdad sale del bolsillo: lleva el gas que se quema."
            />
            <Cifra
              etiqueta="Costo de producción"
              valor={formatCosto(precio.production_cost)}
              pista="La base comercial: lleva la tarifa que el taller cobra por encender."
            />
            <Cifra etiqueta="Gas real" valor={formatCosto(precio.gas_cost)} />
            {usaReglas010P ? <>
              <Cifra etiqueta="Administración" valor={formatCosto(precio.administration_cost)} pista={datos.cotizacion?.production_type === "RETAIL" ? "Por menor: valor que devuelve el backend." : "Valor que devuelve el backend para este pedido."} />
              <Cifra etiqueta="Mano de obra externa imputada" valor={formatCosto(precio.commercial_external_labor_cost)} />
              <Cifra etiqueta="Mano de obra externa real" valor={formatCosto(precio.real_external_labor_cost)} />
              <Cifra etiqueta="Diferencia de mano de obra" valor={formatCosto(precio.labor_cost_gap)} />
              <Cifra etiqueta="Tiempo activo" valor={formatHours(precio.active_production_hours)} />
              <Cifra etiqueta="Espacio por hora aplicado" valor={formatCosto(precio.effective_space_cost_per_hour)} />
            </> : null}
            <Cifra etiqueta="Tarifa de quema" valor={formatCosto(precio.firing_commercial_cost)} />
            <Cifra
              etiqueta="Diferencia de quema"
              valor={formatCosto(precio.firing_difference)}
              pista="Lo que deja la quema por sí sola. No es el margen de la cotización."
            />
          </dl>
          {usaReglas010P && precio.external_workers.length > 0 ? (
            <div className="mt-4 overflow-x-auto border-t border-zinc-200 pt-4">
              <h3 className="mb-2 text-xs font-semibold text-zinc-800">Detalle del personal externo</h3>
              <table className="min-w-full text-left text-xs" data-testid="v2next-external-workers">
                <thead className="text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Persona</th><th className="py-2 pr-3">Jornal</th><th className="py-2 pr-3">Jornada</th><th className="py-2 pr-3">Equiv./h</th><th className="py-2 pr-3">Días pagados</th><th className="py-2 pr-3">Comercial</th><th className="py-2">Real</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {precio.external_workers.map((worker) => (
                    <tr key={worker.worker_id}>
                      <td className="py-2 pr-3 text-zinc-900">{worker.name ?? "Trabajador externo"}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatCosto(worker.daily_rate)}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatHours(worker.workday_hours)}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatCosto(worker.hourly_equivalent)}</td>
                      <td className="py-2 pr-3 tabular-nums">{worker.days_paid}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatCosto(worker.commercial_cost)}</td>
                      <td className="py-2 tabular-nums">{formatCosto(worker.real_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Desplegable>

        <section
          aria-label="Factor comercial"
          className="rounded-2xl border border-black/[0.06] bg-white/60 p-4 sm:p-5"
        >
          {/* En un teléfono el factor va a lo ancho y el precio debajo: lado a
              lado, las marcas del deslizador se pisaban. */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <FactorControl
              factor={precio.commercial_factor}
              minimo={precio.factor_min}
              maximo={precio.factor_max}
              objetivo={precio.factor_target}
              editable={canEdit}
              fallo={guardar.isError}
              onCommit={(valor) => guardar.mutate({ commercial_factor: valor })}
            />
            <div className="sm:text-right">
              <p className="text-[13px] text-zinc-600">Precio sin IGV</p>
              <p
                data-testid="v2next-subtotal"
                className="text-[28px] font-extrabold leading-tight tracking-tight text-zinc-950 tabular-nums"
              >
                {sinFactor ? "—" : formatPrecio(precio.subtotal, moneda)}
              </p>
              {guardar.isPending ? (
                <p className="text-[11.5px] text-zinc-500">Recalculando…</p>
              ) : null}
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-black/[0.06] pt-4 sm:grid-cols-3">
            <Cifra
              etiqueta={
                precio.factor_min ? `Precio mínimo ${etiquetaDeFactor(precio.factor_min)}` : "Precio mínimo"
              }
              valor={sinFactor ? "—" : formatCosto(precio.price_min)}
              pista="Por debajo no se vende."
            />
            <Cifra
              etiqueta={
                precio.factor_target
                  ? `Precio objetivo ${etiquetaDeFactor(precio.factor_target)}`
                  : "Precio objetivo"
              }
              valor={sinFactor ? "—" : formatCosto(precio.price_target)}
              pista="El factor objetivo de la casa."
            />
            <Cifra
              etiqueta="Precio negociado"
              valor={sinFactor ? "—" : formatCosto(precio.negotiated_price)}
              pista="Costo de producción por el factor elegido, antes de redondear."
            />
            <Cifra
              etiqueta="Ajuste por redondeo"
              valor={sinFactor ? "—" : formatCosto(precio.rounding_adjustment)}
              pista="Lo que el redondeo comercial añadió."
            />
            <Cifra
              etiqueta="Margen efectivo"
              valor={sinFactor ? "—" : formatPercentage(precio.effective_margin_percent)}
              pista="Sobre el precio, no sobre el costo."
              tono={perdida ? "text-red-700" : "text-emerald-700"}
            />
            <Cifra
              etiqueta={perdida ? "Ganancia estimada (pérdida)" : "Ganancia estimada"}
              valor={sinFactor ? "—" : formatCosto(precio.estimated_profit)}
              pista="Precio sin IGV menos costo real."
              tono={perdida ? "text-red-700" : "text-emerald-700"}
            />
          </dl>
          {esMonedaExtranjera(moneda.currency_code) ? (
            <p className="mt-3 text-[11.5px] text-zinc-500">
              Mínimo, objetivo, negociado y ganancia van en soles, antes de convertir; el precio sin
              IGV, en {moneda.currency_code}.
            </p>
          ) : null}
          {guardar.isError ? (
            <p role="alert" className="mt-3 text-xs text-red-700">
              No se pudo guardar el factor: {describeError(guardar.error)}
            </p>
          ) : null}
        </section>

        <V2ExtrasPanel quotationId={quotationId} canEdit={canEdit} />

        <PricePerPieceTable precio={precio} moneda={moneda} />

        <Desplegable titulo="Cómo se reparte el costo entre las piezas">
          <CostAllocationTable precio={precio} moneda={moneda} />
        </Desplegable>

        <Desplegable titulo="Si el cliente pide rebaja" testId="v2next-rebaja">
          <V2ReductionsPanel quotationId={quotationId} embebido />
        </Desplegable>
      </div>
    </Panel>
  );
}
