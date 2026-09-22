import { Link } from "react-router-dom";

import { ArrowRightIcon } from "@/components/icons";
import { Badge } from "@/features/masters/MasterTable";
import type { KilnBatch, KilnBatchStatus } from "@/types/kilnBatches";

interface KilnLayoutHeaderProps {
  batch: KilnBatch;
  version: number;
  kilnWidth: string | number;
  kilnDepth: string | number;
  kilnHeight: string | number;
  isReadOnly: boolean;
}

function statusLabel(value: KilnBatchStatus): string {
  const labels: Record<KilnBatchStatus, string> = {
    PLANNED: "Planificada",
    STARTED: "Encendida",
    COMPLETED: "Completada",
    CANCELLED: "Anulada",
  };
  return labels[value] ?? value;
}

function statusTone(value: KilnBatchStatus): "neutral" | "positive" | "warning" | "danger" {
  if (value === "COMPLETED") return "positive";
  if (value === "STARTED") return "warning";
  if (value === "CANCELLED") return "danger";
  return "neutral";
}

export function KilnLayoutHeader({
  batch,
  version,
  kilnWidth,
  kilnDepth,
  kilnHeight,
  isReadOnly,
}: KilnLayoutHeaderProps) {
  return (
    <header className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link
              to="/produccion/hornadas"
              className="flex items-center gap-1 font-medium hover:text-zinc-800 hover:underline"
            >
              Hornadas
              <ArrowRightIcon className="size-3" />
            </Link>
            <span className="font-mono font-bold text-zinc-900">{batch.code}</span>
            <span>·</span>
            <span>{batch.kiln_name_snapshot}</span>
            <span>·</span>
            <span>{batch.firing_type === "LOW" ? "Baja" : "Alta"}</span>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
            Mapa de distribución física del horno
          </h1>
          <p className="text-xs text-zinc-500">
            Dimensiones útiles:{" "}
            <span className="font-medium text-zinc-800">
              {kilnWidth} × {kilnDepth} × {kilnHeight} cm
            </span>{" "}
            (ancho × fondo × alto)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isReadOnly ? (
            <Badge tone="warning">Solo lectura · {statusLabel(batch.status)}</Badge>
          ) : (
            <Badge tone={statusTone(batch.status)}>{statusLabel(batch.status)}</Badge>
          )}
          <span className="rounded-lg border border-zinc-200 bg-white/80 px-2.5 py-1 text-xs font-semibold text-zinc-700">
            Versión: {version}
          </span>
        </div>
      </div>
    </header>
  );
}
