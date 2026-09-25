import { formatCosto } from "@/features/cotizadorV2/moneda";
import { formatDecimalString, formatPercentage } from "@/features/firings/labels";
import { KilnChamberGauge } from "@/features/cotizadorV2Next/steps/kiln/KilnChamberGauge";
import type { V2KilnOption } from "@/types/quoterV2Firing";

function numero(valor: string | null | undefined): number {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function litros(capacityCm3: string): string {
  const valor = numero(capacityCm3) / 1000;
  return `${formatDecimalString(String(valor), 1)} L`;
}

function estadoDeCarga(horno: V2KilnOption): string {
  if (horno.firing_count > 1) return `Necesita ${horno.firing_count} hornadas`;
  return `Se llena al ${formatPercentage(horno.occupancy_percent)}`;
}

export function KilnOptionCard({
  horno,
  seleccionado,
  batchLoads,
  maxCapacityCm3,
}: {
  horno: V2KilnOption;
  seleccionado: boolean;
  batchLoads: readonly string[];
  maxCapacityCm3: string;
}) {
  const tarifa =
    horno.has_rates && horno.commercial_total !== null
      ? formatCosto(horno.commercial_total)
      : "Sin tarifas";
  const gas = horno.has_rates && horno.gas_total !== null ? formatCosto(horno.gas_total) : "—";

  return (
    <div
      data-testid={`kiln-option-card-${horno.kiln_id}`}
      className="flex flex-col gap-4 sm:flex-row sm:items-end"
    >
      <KilnChamberGauge
        seleccionado={seleccionado}
        batchLoads={batchLoads}
        occupancyPercent={horno.occupancy_percent}
        firingCount={horno.firing_count}
        capacityCm3={horno.capacity_cm3}
        maxCapacityCm3={maxCapacityCm3}
      />
      <dl className="grid flex-1 grid-cols-2 gap-3 text-xs">
        <div className="col-span-2">
          <dt className="text-zinc-500">Carga</dt>
          <dd className="text-[13px] font-semibold text-zinc-900">{estadoDeCarga(horno)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Capacidad</dt>
          <dd className="font-semibold tabular-nums text-zinc-900">{litros(horno.capacity_cm3)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Tarifa</dt>
          <dd className="font-semibold tabular-nums text-zinc-900">{tarifa}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-zinc-500">Gas real</dt>
          <dd className="tabular-nums text-zinc-600">{gas}</dd>
        </div>
      </dl>
    </div>
  );
}
