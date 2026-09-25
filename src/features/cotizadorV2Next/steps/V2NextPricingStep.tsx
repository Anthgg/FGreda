import type { ReactNode } from "react";

import { Spinner } from "@/components/Spinner";
import { Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import { formatPercentage } from "@/features/firings/labels";
import { V2ExtrasPanel } from "@/features/cotizadorV2/V2ExtrasPanel";
import { V2ReductionsPanel } from "@/features/cotizadorV2/V2ReductionsPanel";
import { etiquetaDeFactor } from "@/features/cotizadorV2/factor";
import { formatCosto, formatPrecio, type MonedaDeCotizacion } from "@/features/cotizadorV2/moneda";
import { esMonedaExtranjera } from "@/features/cotizadorV2/pasos";
import { useSetV2Pricing, useV2Pricing } from "@/features/cotizadorV2/useQuoterV2Pricing";
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

export function V2NextPricingStep({ quotationId, canEdit, datos }: PasoDelAsistenteProps) {
  const query = useV2Pricing(quotationId);
  const guardar = useSetV2Pricing(quotationId);

  if (query.isPending) return <Spinner className="size-5" label="Calculando el precio…" />;
  if (query.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {describeError(query.error)}
      </div>
    );
  }

  const precio = query.data;
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

        <Desplegable titulo="Costo real y quema">
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
            <Cifra etiqueta="Tarifa de quema" valor={formatCosto(precio.firing_commercial_cost)} />
            <Cifra
              etiqueta="Diferencia de quema"
              valor={formatCosto(precio.firing_difference)}
              pista="Lo que deja la quema por sí sola. No es el margen de la cotización."
            />
          </dl>
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
