import { Spinner } from "@/components/Spinner";
import { formatMoney } from "@/features/quotations/money";
import { useV2Reductions } from "@/features/cotizadorV2/useQuoterV2Pricing";
import type { V2Reduction, V2ReductionCode } from "@/types/quoterV2Pricing";

/**
 * Reducciones: cómo bajar el precio si el cliente lo pide. Fase 010J.
 *
 * Es la hoja «Reducciones» del Excel final. Cada fila es una PALANCA con el
 * subtotal que dejaría si se usara, estimado como «subtotal actual − ahorro de
 * costo × factor», antes del redondeo por línea.
 *
 * **No aplica nada.** No hay un botón que cambie el horno o el factor desde
 * aquí: cada palanca se mueve en el paso que la controla, y así queda claro
 * quién decidió qué. El factor sugerido nunca baja de ×2.
 */

const TITULO: Record<V2ReductionCode, string> = {
  OTHER_KILN: "Usar otro horno",
  MIN_FACTOR: "Bajar el factor al mínimo",
  REMOVE_ILLUSTRATION: "Quitar la ilustración",
  REMOVE_EXTRAS: "Quitar los adicionales",
  INTERNAL_STAFF: "Hacerlo con personal interno",
  SHARED_FIRING: "Quema compartida en vez de exclusiva",
};

const DONDE: Record<V2ReductionCode, string> = {
  OTHER_KILN: "Se cambia en el paso de Quema.",
  MIN_FACTOR: "Se cambia arriba, en el factor comercial.",
  REMOVE_ILLUSTRATION: "Se cambia en Mano de obra, bloque Ilustración.",
  REMOVE_EXTRAS: "Se cambia en Adicionales.",
  INTERNAL_STAFF: "Se cambia en Mano de obra, eligiendo a otra persona.",
  SHARED_FIRING: "Se cambia en el paso de Quema, modo de quema.",
};

function detalle(item: V2Reduction): string {
  if (!item.applicable) return "No aplica en esta cotización.";
  if (item.code === "OTHER_KILN" && item.suggestion) return `Horno sugerido: ${item.suggestion}.`;
  if (item.code === "MIN_FACTOR" && item.suggestion)
    return `Factor sugerido: ×${Number(item.suggestion).toFixed(2)}. Nunca por debajo de ×2.`;
  return DONDE[item.code];
}

export function V2ReductionsPanel({
  quotationId,
  embebido = false,
}: {
  quotationId: number;
  /** Dentro de un desplegable que ya lo titula: sin marco ni título propio. */
  embebido?: boolean;
}) {
  const query = useV2Reductions(quotationId);

  if (query.isPending) return <Spinner className="size-5" label="Calculando reducciones..." />;
  if (query.isError || !query.data) return null;
  const datos = query.data;
  // Sin factor el backend no estima nada y devuelve la lista vacía.
  if (!Array.isArray(datos.items) || datos.items.length === 0) return null;
  // Las estimaciones vienen en la moneda que el backend declara (la base del
  // taller): se escriben con ESA moneda, no con la de la cotización.
  const dinero = (valor: string) => formatMoney(valor, datos.currency_code);

  return (
    <section
      className={embebido ? "" : "mt-4 rounded-2xl border border-black/[0.06] bg-white/60 p-4"}
      data-testid="panel-reducciones"
    >
      {embebido ? null : (
        <h3 className="text-sm font-semibold text-zinc-900">Si el cliente pide bajar el precio</h3>
      )}
      <p className="mt-1 text-xs text-zinc-500">
        Estimaciones sobre el subtotal actual ({dinero(datos.current_subtotal)}), antes del redondeo
        por producto. Son sugerencias: aquí no se cambia nada.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-[13px]">
          <thead>
            <tr className="text-xs text-zinc-500">
              <th scope="col" className="py-2 pr-3 font-semibold">Alternativa</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Ahorro sin IGV</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Subtotal estimado</th>
              <th scope="col" className="py-2 font-semibold">Dónde se decide</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {datos.items.map((item) => (
              <tr key={item.code} className={item.applicable ? "" : "text-zinc-500"}>
                <td className="py-2 pr-3">{TITULO[item.code]}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {item.applicable ? dinero(item.savings) : "—"}
                </td>
                <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                  {item.applicable ? dinero(item.estimated_subtotal) : "—"}
                </td>
                <td className="py-2 text-xs">{detalle(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
