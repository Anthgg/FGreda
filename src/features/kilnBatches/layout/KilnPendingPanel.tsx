import { getOrderStyle } from "./kilnLayoutMath";
import type { KilnBatchAssignment } from "@/types/kilnBatches";

export interface PlacedItemCount {
  batch_assignment_id: number;
  quantity: number;
}

interface KilnPendingPanelProps {
  assignments: KilnBatchAssignment[];
  placements: PlacedItemCount[];
}

export function KilnPendingPanel({ assignments, placements }: KilnPendingPanelProps) {
  // Contar cuántos placements hay por cada assignment
  const placementCountByAsgn = placements.reduce<Record<number, number>>((acc, p) => {
    acc[p.batch_assignment_id] = (acc[p.batch_assignment_id] || 0) + p.quantity;
    return acc;
  }, {});

  const pendingList = assignments.map((asgn) => {
    const placed = placementCountByAsgn[asgn.id] || 0;
    const pending = Math.max(0, asgn.quantity - placed);
    const orderLabel = asgn.production_order_id
      ? `OP #${asgn.production_order_id}`
      : `CI #${asgn.internal_load_id}`;

    return {
      asgn,
      placed,
      pending,
      orderLabel,
    };
  });

  const totalPending = pendingList.reduce((acc, item) => acc + item.pending, 0);

  return (
    <aside className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-5 flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Piezas pendientes
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
            totalPending > 0
              ? "bg-amber-100 text-amber-800"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {totalPending} {totalPending === 1 ? "pendiente" : "pendientes"}
        </span>
      </div>

      <div className="mt-3 overflow-y-auto space-y-2.5 flex-1 pr-1 max-h-[60vh]">
        {totalPending === 0 ? (
          <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-6 text-center text-xs text-emerald-800">
            <svg
              className="mx-auto size-6 text-emerald-500 mb-1.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="font-semibold">¡Todas las piezas están ubicadas!</p>
            <p className="mt-1 text-emerald-600">
              No hay piezas pendientes de colocación en esta hornada.
            </p>
          </div>
        ) : (
          pendingList
            .filter((item) => item.pending > 0)
            .map(({ asgn, placed, pending, orderLabel }) => {
              const style = getOrderStyle(orderLabel);

              return (
                <div
                  key={asgn.id}
                  className="rounded-xl border border-zinc-200 bg-white/80 p-3 shadow-2xs text-xs space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900 truncate">
                        {asgn.product_name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ backgroundColor: style.fillColor }}
                          aria-hidden="true"
                        />
                        <span className="font-mono text-[11px] font-medium text-zinc-600">
                          {orderLabel}
                        </span>
                        <span className="text-zinc-400">·</span>
                        <span className="text-[11px] text-zinc-500">
                          {asgn.source_kind === "V2_QUOTATION"
                            ? "V2"
                            : asgn.source_kind === "FIRING_V2"
                            ? "Solo Quema"
                            : "Interno"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-block rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-bold tabular-nums text-zinc-800">
                        {pending} de {asgn.quantity}
                      </span>
                    </div>
                  </div>

                  {/* Barra de progreso de colocación */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full bg-zinc-700 transition-all"
                      style={{
                        width: `${Math.min(100, Math.round((placed / asgn.quantity) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })
        )}
      </div>
    </aside>
  );
}
