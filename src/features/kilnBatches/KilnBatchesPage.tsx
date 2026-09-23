import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { Badge, EmptyState, Pagination } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import {
  useCancelKilnBatch,
  useCompleteKilnBatch,
  useKilnBatches,
  useStartKilnBatch,
} from "@/features/kilnBatches/useKilnBatches";
import type { FiringType, KilnBatch, KilnBatchStatus } from "@/types/kilnBatches";

const ALL = "ALL";
const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: ALL, label: "Todos los estados" },
  { value: "PLANNED", label: "Planificada" },
  { value: "STARTED", label: "Encendida" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Anulada" },
] as const;

const FIRING_OPTIONS = [
  { value: ALL, label: "Baja y alta" },
  { value: "LOW", label: "Baja" },
  { value: "HIGH", label: "Alta" },
] as const;

function firingLabel(value: FiringType): string {
  return value === "LOW" ? "Baja" : "Alta";
}

function statusLabel(value: KilnBatchStatus): string {
  const labels: Record<KilnBatchStatus, string> = {
    PLANNED: "Planificada",
    STARTED: "Encendida",
    COMPLETED: "Completada",
    CANCELLED: "Anulada",
  };
  return labels[value];
}

function statusTone(value: KilnBatchStatus): "neutral" | "positive" | "warning" | "danger" {
  if (value === "COMPLETED") return "positive";
  if (value === "STARTED") return "warning";
  if (value === "CANCELLED") return "danger";
  return "neutral";
}

function shortDate(value: string | null): string {
  return value ? value.slice(0, 10) : "-";
}

function percent(value: string): string {
  return `${Number(value).toFixed(1)}%`;
}

function cm3(value: string): string {
  return Number(value).toLocaleString("es-PE", {
    maximumFractionDigits: 0,
  });
}

function BatchDetail({
  batch,
  onStart,
  onComplete,
  onCancel,
  busy,
}: {
  batch: KilnBatch;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <aside className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-zinc-900">{batch.code}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {batch.kiln_name_snapshot} · {firingLabel(batch.firing_type)}
          </p>
        </div>
        <Badge tone={statusTone(batch.status)}>{statusLabel(batch.status)}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-zinc-200 bg-white/70 p-3">
          <p className="text-zinc-500">Ocupado</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
            {percent(batch.occupancy_percent)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white/70 p-3">
          <p className="text-zinc-500">Disponible</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
            {percent(batch.available_percent)}
          </p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full bg-zinc-900"
          style={{ width: `${Math.min(Number(batch.occupancy_percent), 100)}%` }}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-zinc-500">Fecha</dt>
        <dd className="text-right font-medium text-zinc-800">{shortDate(batch.scheduled_date)}</dd>
        <dt className="text-zinc-500">Capacidad</dt>
        <dd className="text-right font-medium tabular-nums text-zinc-800">
          {cm3(batch.capacity_snapshot_cm3)} cm³
        </dd>
        <dt className="text-zinc-500">Asignado</dt>
        <dd className="text-right font-medium tabular-nums text-zinc-800">
          {cm3(batch.assigned_volume_cm3)} cm³
        </dd>
        <dt className="text-zinc-500">Exclusiva</dt>
        <dd className="text-right font-medium text-zinc-800">{batch.exclusive ? "Sí" : "No"}</dd>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onStart}
          disabled={busy || batch.status !== "PLANNED"}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-40"
        >
          Encender
        </button>
        <button
          type="button"
          onClick={onComplete}
          disabled={busy || batch.status !== "STARTED"}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-40"
        >
          Completar
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy || batch.status !== "PLANNED"}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-40"
        >
          Anular
        </button>
      </div>

      <div className="mt-3">
        <Link
          to={`/produccion/hornadas/${batch.id}/mapa`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50/80 px-3 py-2 text-xs font-semibold text-amber-900 shadow-2xs hover:bg-amber-100 transition-colors"
        >
          <svg className="size-4 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          Mapa y distribución del horno
        </Link>
      </div>

      <div className="mt-5">
        <h2 className="text-xs font-semibold uppercase text-zinc-500">Asignaciones</h2>
        {batch.assignments.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-500">
            Sin piezas asignadas.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white/75">
            {batch.assignments.map((assignment) => (
              <div key={assignment.id} className="grid grid-cols-[1fr_auto] gap-3 p-3 text-xs">
                <div>
                  <p className="font-medium text-zinc-900">{assignment.product_name}</p>
                  <p className="mt-0.5 text-zinc-500">
                    {assignment.source_kind} ·{" "}
                    {assignment.production_order_id ? (
                      <Link
                        to={`/produccion/${assignment.production_order_id}`}
                        className="font-mono hover:underline"
                      >
                        OP #{assignment.production_order_id}
                      </Link>
                    ) : (
                      <span className="font-mono">CI #{assignment.internal_load_id}</span>
                    )}
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <p className="font-semibold text-zinc-900">{assignment.quantity} pzas.</p>
                  <p className="text-zinc-500">{cm3(assignment.assigned_volume_cm3)} cm³</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

export function KilnBatchesPage() {
  const [status, setStatus] = useState<string>("PLANNED");
  const [firingType, setFiringType] = useState<string>(ALL);
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => setOffset(0), [status, firingType]);

  const filters = useMemo(
    () => ({
      ...(status !== ALL ? { status: status as KilnBatchStatus } : {}),
      ...(firingType !== ALL ? { firing_type: firingType as FiringType } : {}),
      limit: PAGE_SIZE,
      offset,
    }),
    [firingType, offset, status],
  );
  const batches = useKilnBatches(filters);
  const items = useMemo(() => batches.data?.items ?? [], [batches.data?.items]);
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  useEffect(() => {
    const first = items[0];
    if (selectedId === null && first) {
      setSelectedId(first.id);
    }
    if (selectedId !== null && first && !items.some((item) => item.id === selectedId)) {
      setSelectedId(first.id);
    }
  }, [items, selectedId]);

  const start = useStartKilnBatch();
  const complete = useCompleteKilnBatch();
  const cancel = useCancelKilnBatch();
  const busy = start.isPending || complete.isPending || cancel.isPending;
  const mutationError = start.error ?? complete.error ?? cancel.error;

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <TypewriterTitle
            text="Hornadas."
            className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl"
          />
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
            Planificación operativa de horno por fecha, ciclo, capacidad y piezas asignadas.
          </p>
        </div>
        <Link
          to="/produccion"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Órdenes
        </Link>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SelectField
              label="Estado"
              value={status}
              options={STATUS_OPTIONS}
              onChange={setStatus}
            />
            <SelectField
              label="Ciclo"
              value={firingType}
              options={FIRING_OPTIONS}
              onChange={setFiringType}
            />
          </div>

          {mutationError ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {describeError(mutationError)}
            </p>
          ) : null}

          <div className="mt-4">
            {batches.isPending ? (
              <div className="flex justify-center py-16">
                <Spinner className="size-5" label="Cargando hornadas…" />
              </div>
            ) : batches.isError ? (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700"
              >
                {describeError(batches.error)}
              </p>
            ) : items.length === 0 ? (
              <EmptyState message="No hay hornadas con esos filtros." />
            ) : (
              <>
                <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white/80">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-zinc-50 text-[10px] uppercase text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Hornada</th>
                        <th className="px-4 py-3 font-semibold">Horno</th>
                        <th className="px-4 py-3 font-semibold">Ciclo</th>
                        <th className="px-4 py-3 font-semibold">Fecha</th>
                        <th className="px-4 py-3 font-semibold">Estado</th>
                        <th className="px-4 py-3 text-right font-semibold">Ocupación</th>
                        <th className="px-4 py-3 text-right font-semibold">Piezas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {items.map((batch) => (
                        <tr
                          key={batch.id}
                          onClick={() => setSelectedId(batch.id)}
                          className={[
                            "cursor-pointer hover:bg-zinc-50/80",
                            selected?.id === batch.id ? "bg-zinc-100/80" : "",
                          ].join(" ")}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-zinc-900">
                              {batch.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-600">{batch.kiln_name_snapshot}</td>
                          <td className="px-4 py-3">{firingLabel(batch.firing_type)}</td>
                          <td className="px-4 py-3 text-zinc-500">
                            {shortDate(batch.scheduled_date)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={statusTone(batch.status)}>
                              {statusLabel(batch.status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {percent(batch.occupancy_percent)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {batch.assignments.length}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  total={batches.data!.total}
                  limit={batches.data!.limit}
                  offset={batches.data!.offset}
                  onOffsetChange={setOffset}
                />
              </>
            )}
          </div>
        </section>

        {selected ? (
          <BatchDetail
            batch={selected}
            busy={busy}
            onStart={() => start.mutate(selected.id)}
            onComplete={() => complete.mutate(selected.id)}
            onCancel={() => cancel.mutate({ id: selected.id })}
          />
        ) : null}
      </div>
    </div>
  );
}
