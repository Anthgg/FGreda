/**
 * Modal de detalle de receta: cabecera, composicion activa, historial de
 * versiones y calculador de batch.
 *
 * Solo lectura para usuarios normales; ADMIN puede activar versiones.
 */

import { useState } from "react";

import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { useSession } from "@/features/auth/useSession";
import { describeError } from "@/features/settings/messages";
import { Badge } from "@/features/masters/MasterTable";
import {
  useActivateVersion,
  useCreateVersion,
  useRecipe,
} from "@/features/recipes/useRecipes";
import { RecipeCalculatorModal } from "@/features/recipes/RecipeCalculatorModal";
import { RecipeVersionForm } from "@/features/recipes/RecipeVersionForm";
import type { RecipeVersionOut } from "@/types/recipes";

interface Props {
  recipeId: number;
  onClose: () => void;
}

function statusBadgeTone(status: string) {
  if (status === "ACTIVE") return "positive" as const;
  if (status === "DRAFT") return "warning" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  if (status === "ACTIVE") return "Activa";
  if (status === "DRAFT") return "Borrador";
  return "Archivada";
}

function componentTypeLabel(t: string) {
  if (t === "BASE") return "Base";
  if (t === "COLORANT") return "Colorante";
  return "Aditivo";
}

function componentTypeTone(t: string) {
  if (t === "COLORANT") return "warning" as const;
  if (t === "ADDITIVE") return "neutral" as const;
  return "positive" as const;
}

export function RecipeDetailModal({ recipeId, onClose }: Props) {
  const { data: user } = useSession();
  const isAdmin = user?.role === "ADMIN";

  const recipe = useRecipe(recipeId);
  const activate = useActivateVersion(recipeId);
  const createVersion = useCreateVersion(recipeId);

  const [calcVersionId, setCalcVersionId] = useState<number | null>(null);
  const [creatingVersion, setCreatingVersion] = useState(false);

  if (recipe.isLoading) {
    return (
      <ModalWrapper onClose={onClose}>
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      </ModalWrapper>
    );
  }

  if (recipe.isError || !recipe.data) {
    return (
      <ModalWrapper onClose={onClose}>
        <p className="text-center text-sm text-red-600 py-10">
          {describeError(recipe.error)}
        </p>
      </ModalWrapper>
    );
  }

  const r = recipe.data;

  const handleActivate = async (versionId: number) => {
    await activate.mutateAsync(versionId);
  };

  return (
    <>
      <ModalWrapper onClose={onClose}>
        {/* Cabecera */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{r.name}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {r.product_ref} · {r.product_name}
            </p>
          </div>
          <div className="flex gap-2">
            {r.current_version_id && (
              <SecondaryButton onClick={() => setCalcVersionId(r.current_version_id)}>
                Calculador
              </SecondaryButton>
            )}
            {isAdmin && (
              <PrimaryButton onClick={() => setCreatingVersion(true)}>
                Nueva versión
              </PrimaryButton>
            )}
          </div>
        </div>

        {/* Version activa */}
        {r.current_version && (
          <ActiveVersionCard version={r.current_version} />
        )}

        {/* Historial de versiones */}
        <section className="mt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Historial de versiones
          </h3>
          <div className="space-y-3">
            {r.current_version
              ? (
                <VersionRow
                  version={r.current_version}
                  isAdmin={isAdmin}
                  onActivate={handleActivate}
                  onCalc={setCalcVersionId}
                  activating={activate.isPending}
                />
              )
              : <p className="text-sm text-zinc-500">Sin versiones.</p>
            }
          </div>
        </section>
      </ModalWrapper>

      {calcVersionId !== null && (
        <RecipeCalculatorModal
          versionId={calcVersionId}
          onClose={() => setCalcVersionId(null)}
        />
      )}

      {creatingVersion && isAdmin && (
        <RecipeVersionForm
          recipeId={recipeId}
          onClose={() => setCreatingVersion(false)}
          onSubmit={async (payload, activate) => {
            await createVersion.mutateAsync({ payload, activate });
            setCreatingVersion(false);
          }}
          isPending={createVersion.isPending}
        />
      )}
    </>
  );
}

function ActiveVersionCard({ version }: { version: RecipeVersionOut }) {
  const yf = parseFloat(version.yield_factor);
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-emerald-800">
          Versión {version.version_number} — activa
        </span>
        <span className="text-xs text-emerald-700">
          Rendimiento: ×{isNaN(yf) ? "—" : yf.toFixed(4)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              <th className="pb-1 pr-4 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Tipo
              </th>
              <th className="pb-1 pr-4 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Componente
              </th>
              <th className="pb-1 text-right text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {version.lines.map((line) => (
              <tr key={line.id}>
                <td className="py-0.5 pr-4">
                  <Badge tone={componentTypeTone(line.component_type)}>
                    {componentTypeLabel(line.component_type)}
                  </Badge>
                </td>
                <td className="py-0.5 pr-4 text-zinc-800">
                  {line.component_product_name}
                  <span className="ml-1 font-mono text-zinc-400">
                    {line.component_product_ref}
                  </span>
                </td>
                <td className="py-0.5 text-right font-mono text-zinc-700">
                  {parseFloat(line.percentage).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VersionRow({
  version,
  isAdmin,
  onActivate,
  onCalc,
  activating,
}: {
  version: RecipeVersionOut;
  isAdmin: boolean;
  onActivate: (id: number) => void;
  onCalc: (id: number) => void;
  activating: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-zinc-900">
          v{version.version_number}
        </span>
        <Badge tone={statusBadgeTone(version.status)}>
          {statusLabel(version.status)}
        </Badge>
        <span className="text-xs text-zinc-400">
          {version.lines.length} componentes
        </span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onCalc(version.id)}
          className="text-xs text-zinc-500 hover:text-zinc-900 underline"
        >
          Simular
        </button>
        {isAdmin && version.status !== "ACTIVE" && (
          <button
            type="button"
            disabled={activating}
            onClick={() => onActivate(version.id)}
            className="text-xs text-emerald-600 hover:text-emerald-800 underline disabled:opacity-50"
          >
            Activar
          </button>
        )}
      </div>
    </div>
  );
}

function ModalWrapper({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
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
