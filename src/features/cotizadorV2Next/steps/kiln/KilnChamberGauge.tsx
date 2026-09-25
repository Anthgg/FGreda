/**
 * Miniatura visual de hornadas.
 *
 * El backend ya decidio cuantas hornadas hacen falta y cuanta carga lleva cada
 * una. Este componente solo traduce esos porcentajes a una figura para comparar
 * hornos sin introducir dimensiones fisicas ni reglas de precio antiguas.
 */

const CAMARAS_VISIBLES = 3;

function numero(valor: string | null | undefined): number {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function limitarPorcentaje(valor: number): number {
  return Math.max(0, Math.min(100, valor));
}

function etiquetaDato(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1);
}

function calcularCargasDelGauge({
  seleccionado,
  batchLoads,
  occupancyPercent,
  firingCount,
}: {
  seleccionado: boolean;
  batchLoads: readonly string[];
  occupancyPercent: string;
  firingCount: number;
}): number[] {
  if (seleccionado && batchLoads.length > 0) {
    return batchLoads.map((carga) => limitarPorcentaje(numero(carga)));
  }

  const cantidad = Math.max(firingCount, 1);
  const ocupacion = numero(occupancyPercent);
  return Array.from({ length: cantidad }, (_valor, indice) => {
    if (indice < cantidad - 1) return 100;
    return limitarPorcentaje(ocupacion - 100 * (cantidad - 1));
  });
}

export function KilnChamberGauge({
  seleccionado,
  batchLoads,
  occupancyPercent,
  firingCount,
  capacityCm3,
  maxCapacityCm3,
}: {
  seleccionado: boolean;
  batchLoads: readonly string[];
  occupancyPercent: string;
  firingCount: number;
  capacityCm3: string;
  maxCapacityCm3: string;
}) {
  const cargas = calcularCargasDelGauge({
    seleccionado,
    batchLoads,
    occupancyPercent,
    firingCount,
  });
  const maximo = Math.max(numero(maxCapacityCm3), 1);
  const proporcion = Math.max(0.62, Math.min(1, Math.sqrt(numero(capacityCm3) / maximo)));
  const alto = 72 + 32 * proporcion;
  const ancho = 40 + 24 * proporcion;
  const visibles = cargas.slice(0, CAMARAS_VISIBLES);
  const ocultas = Math.max(0, cargas.length - CAMARAS_VISIBLES);

  return (
    <div
      aria-hidden="true"
      data-testid="kiln-chamber-gauge"
      className="flex min-h-[112px] items-end gap-1.5"
    >
      {visibles.map((carga, indice) => (
        <span
          key={indice}
          data-testid="kiln-chamber"
          data-fill={etiquetaDato(carga)}
          className="relative overflow-hidden rounded-t-2xl rounded-b-md border-2 border-zinc-900 bg-zinc-100 shadow-inner"
          style={{ width: `${ancho}px`, height: `${alto}px` }}
        >
          <span
            className="absolute inset-x-0 bottom-0 rounded-t-xl bg-emerald-500/85"
            style={{ height: `${carga}%` }}
          />
        </span>
      ))}
      {ocultas > 0 ? (
        <span className="pb-2 text-xs font-semibold text-zinc-500">+{ocultas}</span>
      ) : null}
    </div>
  );
}
