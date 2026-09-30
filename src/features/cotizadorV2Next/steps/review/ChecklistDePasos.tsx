import { PASOS, type PasoId } from "@/features/cotizadorV2/pasos";
import {
  ETIQUETA_DE_PASO,
  type EstadoVisualDePaso,
} from "@/features/cotizadorV2Next/shell/pasosDelAsistente";

/**
 * Los seis pasos de trabajo, uno por fila, con lo que les falta. 010O.11.
 *
 * El estado es el mismo que pinta la barra de pasos (`estadoVisualDePasos`):
 * `pasos.ts` como pista y los bloqueos del backend como autoridad. Aquí no se
 * vuelve a juzgar nada; solo se enseña junto al documento, con un atajo al
 * paso que hay que completar.
 */
export function ChecklistDePasos({
  pasos,
  irAPaso,
}: {
  pasos: readonly EstadoVisualDePaso[];
  irAPaso: (paso: PasoId) => void;
}) {
  const deTrabajo = pasos.filter((paso) => paso.id !== "resumen");
  return (
    <ol aria-label="Pasos revisados" data-testid="v2next-checklist" className="space-y-1.5">
      {deTrabajo.map((paso) => {
        const numero = PASOS.findIndex((uno) => uno.id === paso.id) + 1;
        const falta = paso.situacion === "falta";
        return (
          <li
            key={paso.id}
            data-situacion={paso.situacion}
            className={[
              "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px]",
              falta ? "border-red-200 bg-red-50" : "border-black/[0.06] bg-white/60",
            ].join(" ")}
          >
            <span
              aria-hidden="true"
              className={[
                "grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] text-[11px] font-bold",
                falta
                  ? "border-red-500 bg-white text-red-600"
                  : paso.situacion === "aviso"
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-emerald-500 bg-emerald-50 text-emerald-700",
              ].join(" ")}
            >
              {falta ? "!" : paso.situacion === "aviso" ? "▲" : "✓"}
            </span>
            <span className="min-w-0 text-zinc-900">
              {numero}. {ETIQUETA_DE_PASO[paso.id].titulo}
              <span className="sr-only">
                {falta ? ": falta" : paso.situacion === "aviso" ? ": con avisos" : ": listo"}
              </span>
              {falta ? (
                <span className="block text-xs text-red-700">
                  {paso.faltas === 1 ? "Falta 1 dato" : `Faltan ${paso.faltas} datos`}
                </span>
              ) : null}
            </span>
            {falta ? (
              <button
                type="button"
                onClick={() => irAPaso(paso.id)}
                className="ml-auto shrink-0 text-xs font-semibold text-zinc-900 underline underline-offset-2 cursor-pointer"
              >
                Completar<span className="sr-only"> {ETIQUETA_DE_PASO[paso.id].titulo}</span>
              </button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
