import { Spinner } from "@/components/Spinner";
import {
  useV2Materials,
  useV2QuotationProducts,
} from "@/features/cotizadorV2/useQuoterV2Materials";
import type { PasoDelAsistenteProps } from "@/features/cotizadorV2Next/shell/pasosDelAsistente";
import { MaterialLineCard } from "@/features/cotizadorV2Next/steps/materials/MaterialLineCard";
import { formatCosto } from "@/features/cotizadorV2/moneda";
import { Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";

export function V2NextMaterialsPanel({
  quotationId,
  canEdit,
  irAPaso,
}: PasoDelAsistenteProps) {
  const pagina = useV2QuotationProducts(quotationId);
  const arcillas = useV2Materials("BODY");
  const esmaltes = useV2Materials("GLAZE");

  const cargando = pagina.isPending || arcillas.isPending || esmaltes.isPending;
  const error = pagina.error ?? arcillas.error ?? esmaltes.error ?? null;

  if (cargando) {
    return (
      <Panel>
        <Spinner className="size-5" label="Cargando materiales..." />
      </Panel>
    );
  }

  if (pagina.isError || arcillas.isError || esmaltes.isError || !pagina.data || !arcillas.data || !esmaltes.data) {
    return (
      <Panel>
        <p role="alert" className="text-sm text-red-700">
          {describeError(error)}
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-zinc-600">
          Elige la arcilla y, si lleva, el esmalte. Cotizar no descuenta inventario.
        </p>
        <p
          data-testid="materials-total"
          className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900"
        >
          Materiales: {formatCosto(pagina.data.materials_cost)}
        </p>
      </div>

      {pagina.data.items.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Primero agrega piezas en el paso Piezas.</p>
          <button
            type="button"
            onClick={() => irAPaso("productos")}
            className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
          >
            Ir a Piezas
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {pagina.data.items.map((linea) => (
            <MaterialLineCard
              key={linea.id}
              quotationId={quotationId}
              canEdit={canEdit}
              linea={linea}
              arcillas={arcillas.data.items}
              esmaltes={esmaltes.data.items}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
