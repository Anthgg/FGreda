/** Insignias y métricas del módulo de recetas. */

import type { ReactNode } from "react";

import {
  COMPONENT_LABEL,
  COMPONENT_TONE,
  VERSION_STATUS_LABEL,
  VERSION_STATUS_TONE,
} from "@/features/recipes/labels";
import type { RecipeComponentType, RecipeStatus } from "@/types/recipes";

export function ComponentBadge({ type }: { type: RecipeComponentType }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${COMPONENT_TONE[type]}`}
    >
      {COMPONENT_LABEL[type]}
    </span>
  );
}

export function VersionStatusBadge({ status }: { status: RecipeStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${VERSION_STATUS_TONE[status]}`}
    >
      {VERSION_STATUS_LABEL[status]}
    </span>
  );
}

/** Métrica compacta: cabe una fila de cuatro sin ocupar media pantalla. */
export function Metric({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "base" | "additional" | "total";
  hint?: string;
}) {
  const tones = {
    neutral: "text-zinc-900",
    base: "text-emerald-700",
    additional: "text-violet-700",
    total: "text-zinc-900",
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white/70 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${tones[tone]}`}>{value}</p>
      {hint ? <p className="text-[10px] text-zinc-400">{hint}</p> : null}
    </div>
  );
}
