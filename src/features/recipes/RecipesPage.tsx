/**
 * Módulo de recetas.
 *
 * Tres vistas con propósitos distintos que no deben mezclarse:
 *
 * - **Listado**: el catálogo productivo, lo que el taller usa a diario.
 * - **Importador**: los datos en preparación, con su propio vocabulario.
 * - **Simulador**: cálculo de un batch sobre una versión existente.
 *
 * «Nueva receta» es una acción, no una vista: por eso vive en la cabecera y no
 * como una cuarta pestaña.
 */

import { useState } from "react";

import { PrimaryButton } from "@/components/form";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { useSession } from "@/features/auth/useSession";
import { RecipeCatalogTab } from "@/features/recipes/RecipeCatalogTab";
import { RecipeCreateModal } from "@/features/recipes/RecipeCreateModal";
import { RecipeImportTab } from "@/features/recipes/RecipeImportTab";
import { RecipeSimulatorTab } from "@/features/recipes/RecipeSimulatorTab";
import { RecipeVersionForm } from "@/features/recipes/RecipeVersionForm";
import { useCreateVersion } from "@/features/recipes/useRecipes";
import type { RecipeOut } from "@/types/recipes";

type TabId = "listado" | "importador" | "simulador";

const TABS: readonly { id: TabId; label: string }[] = [
  { id: "listado", label: "Listado" },
  { id: "importador", label: "Importador" },
  { id: "simulador", label: "Simulador" },
];

/** Formulario de nueva versión, montado solo cuando hay receta elegida. */
function NewVersionDialog({ recipe, onClose }: { recipe: RecipeOut; onClose: () => void }) {
  const createVersion = useCreateVersion(recipe.id);
  return (
    <RecipeVersionForm
      recipeId={recipe.id}
      onClose={onClose}
      onSubmit={async (payload, activate) => {
        await createVersion.mutateAsync({ payload, activate });
        onClose();
      }}
      isPending={createVersion.isPending}
    />
  );
}

export function RecipesPage() {
  const { data: user } = useSession();
  const isAdmin = user?.role === "ADMIN";

  const [tab, setTab] = useState<TabId>("listado");
  const [creating, setCreating] = useState(false);
  const [versionFor, setVersionFor] = useState<RecipeOut | null>(null);
  const [simulatingRecipe, setSimulatingRecipe] = useState<RecipeOut | null>(null);
  const [simulatingVersionId, setSimulatingVersionId] = useState<number | null>(null);

  const simular = (recipe: RecipeOut, versionId?: number) => {
    setSimulatingRecipe(recipe);
    setSimulatingVersionId(versionId ?? recipe.current_version_id ?? null);
    setTab("simulador");
  };

  return (
    <div className="w-full space-y-5">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <TypewriterTitle
            text="Recetas."
            className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl"
          />
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
            Gestión de recetas y materiales preparados.
          </p>
        </div>
        {isAdmin ? (
          <PrimaryButton onClick={() => setCreating(true)}>Nueva receta</PrimaryButton>
        ) : null}
      </header>

      <div className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-5 border-b border-zinc-200/80">
          <nav role="tablist" aria-label="Vistas de recetas" className="-mb-px flex gap-6">
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-selected={active}
                  aria-controls={`panel-${item.id}`}
                  onClick={() => setTab(item.id)}
                  className={[
                    "whitespace-nowrap border-b-2 pb-3 pt-1 text-sm font-medium transition-colors",
                    active
                      ? "border-zinc-900 font-semibold text-zinc-900"
                      : "border-transparent text-zinc-400 hover:border-zinc-300 hover:text-zinc-700",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "listado" ? (
            <RecipeCatalogTab
              canEdit={isAdmin}
              onNewVersion={setVersionFor}
              onSimulate={simular}
            />
          ) : null}
          {tab === "importador" ? <RecipeImportTab canEdit={isAdmin} /> : null}
          {tab === "simulador" ? (
            <RecipeSimulatorTab
              initialRecipe={simulatingRecipe}
              initialVersionId={simulatingVersionId}
            />
          ) : null}
        </div>
      </div>

      {creating && isAdmin ? <RecipeCreateModal onClose={() => setCreating(false)} /> : null}

      {versionFor && isAdmin ? (
        <NewVersionDialog recipe={versionFor} onClose={() => setVersionFor(null)} />
      ) : null}
    </div>
  );
}
