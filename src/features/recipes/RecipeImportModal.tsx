/**
 * Modal de importacion de recetas desde staging (Fase 003.5).
 *
 * Permite visualizar el lote de staging ya subido, revisar y resolver
 * lineas ambiguas (asignar BASE/COLORANT/ADDITIVE o SKIP), y confirmar
 * atomicamente la importacion a recetas productivas cuando este 100% resuelto.
 */

import { useState } from "react";

import { Field, PrimaryButton, SecondaryButton, SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import { Badge } from "@/features/masters/MasterTable";
import { formatDecimal } from "@/features/recipes/formatDecimal";
import {
  useCommitRecipeImport,
  useLatestRecipeBatch,
  useRecipeImportPreview,
  useResolveRecipeImport,
} from "@/features/recipes/useRecipes";
import type {
  RecipeComponentType,
  RecipeRowResolutionIn,
  RecipeStagingGroupOut,
  RecipeStagingLineOut,
} from "@/types/recipes";

interface Props {
  onClose: () => void;
}

const COMPONENT_TYPE_OPTIONS = [
  { value: "BASE", label: "Base" },
  { value: "COLORANT", label: "Colorante" },
  { value: "ADDITIVE", label: "Aditivo" },
] as const;

const ACTION_OPTIONS = [
  { value: "RESOLVE", label: "Incluir (RESOLVE)" },
  { value: "SKIP", label: "Omitir (SKIP)" },
] as const;

export function RecipeImportModal({ onClose }: Props) {
  const latestBatch = useLatestRecipeBatch();
  const batchId = latestBatch.data?.batch_id ?? null;

  const preview = useRecipeImportPreview(batchId);
  const resolve = useResolveRecipeImport(batchId ?? 0);
  const commit = useCommitRecipeImport(batchId ?? 0);

  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [draftType, setDraftType] = useState<RecipeComponentType>("BASE");
  const [draftPercentage, setDraftPercentage] = useState("");
  const [draftAction, setDraftAction] = useState<"RESOLVE" | "SKIP">("RESOLVE");
  const [commitSuccess, setCommitSuccess] = useState(false);

  if (latestBatch.isLoading || preview.isLoading) {
    return (
      <ModalWrapper onClose={onClose}>
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner />
          <p className="mt-3 text-xs text-zinc-500">Analizando staging de recetas...</p>
        </div>
      </ModalWrapper>
    );
  }

  if (latestBatch.isError || preview.isError || !preview.data) {
    return (
      <ModalWrapper onClose={onClose}>
        <p className="text-center text-sm text-red-600 py-10">
          {describeError(latestBatch.error || preview.error)}
        </p>
      </ModalWrapper>
    );
  }

  const p = preview.data;
  const canCommit = p.error_count === 0 && p.review_required_count === 0;

  const handleStartEdit = (line: RecipeStagingLineOut) => {
    setEditingRow(line.row_id);
    setDraftType(line.component_type || line.suggested_component_type || "BASE");
    setDraftPercentage(line.final_percentage);
    setDraftAction(line.action === "SKIP" ? "SKIP" : "RESOLVE");
  };

  const handleSaveResolution = async (rowId: number) => {
    const trimmedPct = draftPercentage.trim();
    const payload: RecipeRowResolutionIn = {
      row_id: rowId,
      action: draftAction,
      ...(draftAction !== "SKIP" ? { component_type: draftType } : {}),
      ...(trimmedPct ? { percentage: trimmedPct } : {}),
    };
    await resolve.mutateAsync([payload]);
    setEditingRow(null);
  };

  const handleCommit = async () => {
    if (!canCommit) return;
    await commit.mutateAsync();
    setCommitSuccess(true);
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-900">
          Importación de recetas desde staging
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Lote #{p.batch_id} · Revisión y resolución de clasificación de componentes
        </p>
      </div>

      {commitSuccess ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-base font-bold text-emerald-800">
            ✓ Recetas importadas exitosamente
          </p>
          <p className="mt-2 text-xs text-emerald-700">
            Las fórmulas han sido transferidas al catálogo productivo de recetas.
          </p>
          <div className="mt-4 flex justify-center">
            <PrimaryButton onClick={onClose}>Cerrar</PrimaryButton>
          </div>
        </div>
      ) : (
        <>
          {/* Métricas de resumen */}
          <div className="mb-5 grid grid-cols-2 sm:grid-cols-5 gap-2">
            <MetricCard label="Recetas" value={String(p.recipes_detected)} />
            <MetricCard label="Líneas" value={String(p.lines_detected)} />
            <MetricCard label="Listas (Ready)" value={String(p.ready_count)} tone="positive" />
            <MetricCard
              label="Revisión"
              value={String(p.review_required_count)}
              tone={p.review_required_count > 0 ? "warning" : "neutral"}
            />
            <MetricCard
              label="Errores"
              value={String(p.error_count)}
              tone={p.error_count > 0 ? "danger" : "neutral"}
            />
          </div>

          {/* Listado de recetas */}
          <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
            {p.recipes.map((group, idx) => (
              <RecipeGroupCard
                key={idx}
                group={group}
                isExpanded={expandedGroup === idx}
                onToggle={() => setExpandedGroup(expandedGroup === idx ? null : idx)}
                editingRow={editingRow}
                draftType={draftType}
                draftPercentage={draftPercentage}
                draftAction={draftAction}
                onStartEdit={handleStartEdit}
                onCancelEdit={() => setEditingRow(null)}
                onDraftTypeChange={setDraftType}
                onDraftPercentageChange={setDraftPercentage}
                onDraftActionChange={setDraftAction}
                onSaveResolution={handleSaveResolution}
                isResolving={resolve.isPending}
              />
            ))}
          </div>

          {/* Footer de confirmacion */}
          <div className="mt-5 border-t border-zinc-200 pt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              {!canCommit && (
                <p className="text-amber-700 font-medium">
                  ⚠ Hay {p.review_required_count} recetas pendientes de revisión o {p.error_count} errores. Resuelva todas antes de confirmar.
                </p>
              )}
              {canCommit && (
                <p className="text-emerald-700 font-medium">
                  ✓ Todas las recetas están listas para ser importadas.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
              <PrimaryButton
                disabled={!canCommit || commit.isPending}
                onClick={handleCommit}
              >
                {commit.isPending ? "Confirmando…" : "Confirmar importación"}
              </PrimaryButton>
            </div>
          </div>
        </>
      )}
    </ModalWrapper>
  );
}

function RecipeGroupCard({
  group,
  isExpanded,
  onToggle,
  editingRow,
  draftType,
  draftPercentage,
  draftAction,
  onStartEdit,
  onCancelEdit,
  onDraftTypeChange,
  onDraftPercentageChange,
  onDraftActionChange,
  onSaveResolution,
  isResolving,
}: {
  group: RecipeStagingGroupOut;
  isExpanded: boolean;
  onToggle: () => void;
  editingRow: number | null;
  draftType: RecipeComponentType;
  draftPercentage: string;
  draftAction: "RESOLVE" | "SKIP";
  onStartEdit: (line: RecipeStagingLineOut) => void;
  onCancelEdit: () => void;
  onDraftTypeChange: (t: RecipeComponentType) => void;
  onDraftPercentageChange: (p: string) => void;
  onDraftActionChange: (a: "RESOLVE" | "SKIP") => void;
  onSaveResolution: (rowId: number) => void;
  isResolving: boolean;
}) {
  const statusTone =
    group.status === "ERROR"
      ? "danger"
      : group.status === "REVIEW_REQUIRED"
      ? "warning"
      : "positive";

  const statusText =
    group.status === "ERROR"
      ? "Error"
      : group.status === "REVIEW_REQUIRED"
      ? "Revisión requerida"
      : "Lista (Ready)";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 text-left hover:bg-zinc-50/80 flex flex-wrap items-center justify-between gap-2"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-zinc-500">
              {group.target_internal_reference || "—"}
            </span>
            <span className="text-sm font-semibold text-zinc-900">
              {group.recipe_name}
            </span>
            <Badge tone={statusTone}>{statusText}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            Base: {formatDecimal(group.base_total)}% · Adicionales: {formatDecimal(group.additional_total)}% · Rendimiento: ×{formatDecimal(group.yield_factor, 4)}
          </p>
        </div>
        <span className="text-xs text-zinc-400 font-bold">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-zinc-100 bg-zinc-50/40 p-4 space-y-3">
          {group.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              {group.warnings.map((w, i) => (
                <p key={i}>⚠ {w}</p>
              ))}
            </div>
          )}

          {group.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 p-2 text-xs text-red-800">
              {group.errors.map((e, i) => (
                <p key={i}>✕ {e}</p>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="pb-1 pr-2">Componente</th>
                  <th className="pb-1 pr-2">Tipo</th>
                  <th className="pb-1 pr-2 text-right">Porcentaje</th>
                  <th className="pb-1 pr-2">Estado</th>
                  <th className="pb-1 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {group.lines.map((line) => (
                  <tr key={line.row_id} className="py-2">
                    <td className="py-2 pr-2 text-zinc-800">
                      <div>{line.component_name_raw}</div>
                      {line.component_reference && (
                        <span className="font-mono text-[10px] text-zinc-400">
                          {line.component_reference}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {line.action === "SKIP" ? (
                        <span className="text-zinc-400 italic">Omitido</span>
                      ) : line.component_type ? (
                        <Badge tone={line.component_type === "BASE" ? "positive" : "warning"}>
                          {line.component_type}
                        </Badge>
                      ) : (
                        <span className="text-amber-600 font-medium text-[11px]">
                          Sugerido: {line.suggested_component_type || "—"}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono">
                      {line.action === "SKIP" ? "—" : `${formatDecimal(line.final_percentage, 2)}%`}
                    </td>
                    <td className="py-2 pr-2">
                      <Badge
                        tone={
                          line.status === "RESOLVED"
                            ? "positive"
                            : line.status === "REVIEW_REQUIRED"
                            ? "warning"
                            : line.status === "SKIPPED"
                            ? "neutral"
                            : "neutral"
                        }
                      >
                        {line.status}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      {editingRow === line.row_id ? (
                        <div className="flex flex-col gap-2 p-2 rounded-lg bg-white border border-zinc-200">
                          <SelectField
                            label="Acción"
                            value={draftAction}
                            options={ACTION_OPTIONS}
                            onChange={(v) => onDraftActionChange(v as "RESOLVE" | "SKIP")}
                            searchable={false}
                          />
                          {draftAction === "RESOLVE" && (
                            <>
                              <SelectField
                                label="Tipo"
                                value={draftType}
                                options={COMPONENT_TYPE_OPTIONS}
                                onChange={(v) => onDraftTypeChange(v as RecipeComponentType)}
                                searchable={false}
                              />
                              <Field label="Porcentaje (%)">
                                {(id) => (
                                  <input
                                    id={id}
                                    type="text"
                                    inputMode="decimal"
                                    value={draftPercentage}
                                    onChange={(e) => onDraftPercentageChange(e.target.value)}
                                    className="w-full h-8 rounded-lg border border-zinc-200 px-2 text-xs font-mono text-right"
                                  />
                                )}
                              </Field>
                            </>
                          )}
                          <div className="flex justify-end gap-1 mt-1">
                            <button
                              type="button"
                              onClick={onCancelEdit}
                              className="text-xs text-zinc-500 px-2 py-1 hover:underline"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={isResolving}
                              onClick={() => onSaveResolution(line.row_id)}
                              className="rounded bg-zinc-900 text-white text-xs px-2 py-1"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onStartEdit(line)}
                          className="text-xs text-zinc-600 hover:text-zinc-900 underline"
                        >
                          Resolver
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  const tones = {
    neutral: "border-zinc-200 bg-zinc-50 text-zinc-800",
    positive: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
  };
  return (
    <div className={`rounded-xl border p-2.5 text-center ${tones[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-75">{label}</p>
      <p className="text-base font-bold mt-0.5">{value}</p>
    </div>
  );
}

function ModalWrapper({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 pb-10"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-900 text-xl font-bold"
          aria-label="Cerrar"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
