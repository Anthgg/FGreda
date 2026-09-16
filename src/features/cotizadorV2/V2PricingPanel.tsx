import { useState } from "react";
import { SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { Panel } from "@/features/masters/MasterTable";
import { TableWrapper, Th, Td } from "@/features/cotizadorV2/components/V2Table";
import { describeError } from "@/features/settings/messages";
import { useSetV2Pricing, useV2Pricing } from "@/features/cotizadorV2/useQuoterV2Pricing";
import { PRICING_WARNING_LABEL, type V2Pricing } from "@/types/quoterV2Pricing";

function pasoDeFactor(minimo: number, maximo: number): number {
  const rango = maximo - minimo;
  if (rango <= 2) return 0.25;
  if (rango <= 5) return 0.5;
  return 1;
}

function opcionesDeFactor(
  actual: string | null,
  minimo: string | null,
  maximo: string | null,
): { value: string; label: string }[] {
  const suelo = Number(minimo ?? 2);
  const techo = Number(maximo ?? 3);
  const paso = pasoDeFactor(suelo, techo);

  const valores: number[] = [];
  for (let valor = suelo; valor <= techo + 1e-9; valor += paso) {
    valores.push(Number(valor.toFixed(2)));
  }
  if (valores.at(-1) !== techo) valores.push(techo);
  if (actual !== null && !valores.some((valor) => valor === Number(actual))) {
    valores.push(Number(actual));
  }

  return valores
    .sort((a, b) => a - b)
    .map((valor) => ({ value: String(valor), label: `×${valor.toFixed(2)}` }));
}

function factorSeleccionado(actual: string | null, opciones: { value: string }[]): string {
  if (actual === null) return opciones.at(-1)?.value ?? "3";
  return (
    opciones.find((opcion) => Number(opcion.value) === Number(actual))?.value ??
    String(Number(actual))
  );
}

function Aviso({ codigo }: { codigo: string }) {
  return <li className="text-xs font-medium text-amber-700">{PRICING_WARNING_LABEL[codigo] ?? codigo}</li>;
}

function Dato({
  label,
  value,
  hint,
  tone,
  large = false,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "positive" | "negative" | "neutral" | undefined;
  large?: boolean;
}) {
  const color =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
        ? "text-red-600"
        : tone === "neutral"
          ? "text-zinc-600"
          : "text-zinc-900";
          
  const size = large ? "text-lg" : "text-sm";
  
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className={`${size} font-bold ${color} mt-0.5`}>{value}</dd>
      {hint ? <dd className="text-[10px] text-zinc-500 mt-1">{hint}</dd> : null}
    </div>
  );
}

function Reparto({ precio }: { precio: V2Pricing }) {
  if (precio.lines.length === 0) return null;
  return (
    <div className="mt-8 rounded-2xl border border-black/10 bg-white shadow-xs overflow-hidden">
      <div className="p-5 border-b border-black/5">
        <h3 className="text-sm font-semibold text-zinc-900">Reparto por Producto</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Desglose del costo de producción y precio unitario asignado a cada línea.
        </p>
      </div>
      <div className="overflow-x-auto">
        <TableWrapper>
          <thead className="bg-zinc-50 text-xs text-zinc-500 border-b border-black/5">
            <tr>
              <Th>Producto</Th>
              <Th align="right">Piezas</Th>
              <Th align="right">C. Directo</Th>
              <Th align="right">Quema</Th>
              <Th align="right">Espacio</Th>
              <Th align="right">Generales</Th>
              <Th align="right" className="font-semibold text-zinc-700">Costo Base</Th>
              <Th align="right">Unitario</Th>
              <Th align="right" className="font-semibold text-zinc-700">Total Línea</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 bg-white">
            {precio.lines.map((linea) => (
              <tr key={linea.line_id} className="hover:bg-zinc-50/50">
                <Td className="font-medium text-zinc-900">
                  {linea.product_name ?? `Línea ${linea.line_id}`}
                </Td>
                <Td align="right">{linea.quantity}</Td>
                <Td align="right">{linea.direct_cost}</Td>
                <Td align="right">{linea.firing_cost}</Td>
                <Td align="right">{linea.space_cost}</Td>
                <Td align="right">{linea.general_cost}</Td>
                <Td align="right" className="font-semibold bg-zinc-50/50">{linea.production_cost}</Td>
                <Td align="right" className="font-medium text-emerald-700">{linea.unit_price}</Td>
                <Td align="right" className="font-bold text-zinc-900">{linea.line_total}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrapper>
      </div>
    </div>
  );
}

export function V2PricingPanel({
  quotationId,
  canEdit,
}: {
  quotationId: number;
  canEdit: boolean;
}) {
  const query = useV2Pricing(quotationId);
  const guardar = useSetV2Pricing(quotationId);
  
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (query.isPending) return <Spinner className="size-5" label="Calculando el precio..." />;
  if (query.isError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
      >
        {describeError(query.error)}
      </div>
    );
  }

  const precio = query.data;
  const perdida = Number(precio.estimated_profit ?? 0) < 0;
  const moneda = precio.currency_code ?? "PEN";
  const opciones = opcionesDeFactor(precio.commercial_factor, precio.factor_min, precio.factor_max);

  return (
    <Panel>
      <div data-testid="panel-precio" className="space-y-6">
        
        {precio.warnings.length > 0 ? (
          <ul className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm" data-testid="avisos-precio">
            {precio.warnings.map((codigo) => (
              <Aviso key={codigo} codigo={codigo} />
            ))}
          </ul>
        ) : null}

        {/* GRAN TARJETA DE PRECIO FINAL */}
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <svg className="w-32 h-32 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative z-10">
            <div>
              <h2 className="text-sm font-bold tracking-widest text-emerald-800/80 uppercase">Precio Total al Cliente</h2>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-5xl font-black text-emerald-950 tracking-tight">{precio.total}</span>
                <span className="text-lg font-semibold text-emerald-700/80">{moneda}</span>
              </div>
              <p className="mt-3 text-sm font-medium text-emerald-800">
                Incluye IGV ({precio.tax_percent ?? "0"}%) de {precio.tax}
              </p>
            </div>
            
            <div className="bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-emerald-100 shadow-xs w-full sm:w-auto">
              <SelectField
                label="Multiplicador Comercial"
                requirement="required"
                value={factorSeleccionado(precio.commercial_factor, opciones)}
                options={opciones}
                onChange={(valor) => guardar.mutate({ commercial_factor: valor })}
                disabled={!canEdit}
                hint="Aplica sobre Costo de Producción"
              />
            </div>
          </div>
        </div>

        {/* COSTOS DIRECTOS (LO QUE CUESTA PRODUCIR) */}
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-xs">
          <div className="flex justify-between items-end border-b border-black/5 pb-4 mb-5">
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Costos de Producción</h3>
              <p className="text-xs text-zinc-500 mt-1">Suma de costos directos (materiales, mano de obra, quema comercial).</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-zinc-900">{precio.production_cost}</span>
            </div>
          </div>
          
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Dato label="Materiales" value={precio.materials_cost} />
            <Dato label="Mano de obra" value={precio.labor_cost} />
            <Dato label="Tarifa de Quema" value={precio.firing_commercial_cost} hint="Valor comercial asignado." />
            <Dato label="Ilustración" value={precio.illustration_cost} />
          </dl>
        </div>

        {/* EXPANDABLE: COSTOS INDIRECTOS & MARGEN */}
        <div className="rounded-2xl border border-black/10 bg-white overflow-hidden shadow-xs">
          <button 
            type="button" 
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full p-5 flex items-center justify-between bg-zinc-50/50 hover:bg-zinc-50 transition-colors focus:outline-none"
          >
            <div className="text-left">
              <h3 className="text-sm font-bold text-zinc-900">Análisis Financiero Avanzado</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Costos indirectos, métricas de rentabilidad y precios sugeridos</p>
            </div>
            <div className={`transform transition-transform duration-200 text-zinc-400 ${showAdvanced ? 'rotate-180' : ''}`}>
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </button>
          
          {showAdvanced && (
            <div className="p-6 border-t border-black/5 space-y-8 bg-white animate-in slide-in-from-top-2 fade-in duration-200">
              
              {/* Costos Indirectos */}
              <div>
                <h4 className="text-xs font-bold text-zinc-400 tracking-wider uppercase mb-4">Costos Indirectos y Reales</h4>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Dato label="Costo Real de Taller" value={precio.real_cost} hint="Base térmica: Gasto real en gas + Materiales." tone="negative" large />
                  <Dato label="Gasto Gas Real" value={precio.gas_cost} tone="neutral" />
                  <Dato label="Dif. Quema (Tarifa - Gas)" value={precio.firing_difference} tone="neutral" />
                  <Dato label="Gastos Administrativos" value={precio.administration_cost} hint="Fijo por cotización" tone="neutral" />
                  <Dato label="Espacio y Servicios" value={precio.space_cost} hint="Días efectivos" tone="neutral" />
                </dl>
              </div>

              <hr className="border-black/5" />

              {/* Referencias de Precio y Ganancia */}
              <div>
                <h4 className="text-xs font-bold text-zinc-400 tracking-wider uppercase mb-4">Métricas de Rentabilidad</h4>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="sm:col-span-2 bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <Dato 
                      label="Ganancia Neta Estimada" 
                      value={precio.estimated_profit} 
                      hint="Total sin IGV - Costo Real" 
                      tone={perdida ? "negative" : "positive"} 
                      large 
                    />
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-emerald-200">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Margen Efectivo:</span>
                      <span className={`text-xs font-black ${perdida ? 'text-red-600' : 'text-emerald-700'}`}>{precio.effective_margin_percent}%</span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-zinc-50 rounded-xl border border-black/5">
                    <Dato label="Precio Objetivo (×3)" value={precio.price_target} hint="Referencia estándar." />
                  </div>
                  <div className="p-4 bg-red-50/50 rounded-xl border border-red-100">
                    <Dato label="Precio Mínimo (×2)" value={precio.price_min} hint="Por debajo es pérdida." tone="negative" />
                  </div>
                </dl>
              </div>

              <div className="text-xs text-zinc-400 text-center pt-2">
                * El Ajuste por Redondeo aplicado al Subtotal es de {precio.rounding_adjustment}.
              </div>

            </div>
          )}
        </div>

        <Reparto precio={precio} />

        {guardar.isError ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {describeError(guardar.error)}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
