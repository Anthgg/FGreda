/**
 * Catálogo de recetas productivas: lista a la izquierda, detalle a la derecha.
 *
 * La búsqueda y la paginación son del servidor, no del navegador: filtrar solo
 * la página cargada daría resultados falsos en cuanto haya más de una página.
 */

import { useEffect, useMemo, useState } from "react";

import { SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { Badge, EmptyState, Pagination, SearchInput } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import { formatDecimal } from "@/features/recipes/formatDecimal";
import { RecipeDetailPanel } from "@/features/recipes/RecipeDetailPanel";
import { useRecipes } from "@/features/recipes/useRecipes";
import type { RecipeOut } from "@/types/recipes";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

type EstadoFiltro = "todas" | "activas" | "inactivas";

const ESTADO_OPCIONES: readonly { value: EstadoFiltro; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "activas", label: "Activas" },
  { value: "inactivas", label: "Inactivas" },
];

function estadoBadge(recipe: RecipeOut) {
  if (!recipe.active) return <Badge tone="neutral">Inactiva</Badge>;
  if (!recipe.current_version_id) return <Badge tone="warning">Sin versión</Badge>;
  return <Badge tone="positive">Activa</Badge>;
}

interface RecipeCatalogTabProps {
  canEdit: boolean;
  onNewVersion: (recipe: RecipeOut) => void;
  onSimulate: (recipe: RecipeOut, versionId?: number) => void;
}

export function RecipeCatalogTab({ canEdit, onNewVersion, onSimulate }: RecipeCatalogTabProps) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [estado, setEstado] = useState<EstadoFiltro>("todas");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // En móvil no caben las dos columnas: al elegir una receta se muestra su
  // detalle como vista propia y se vuelve con un enlace explícito.
  const [mobileDetail, setMobileDetail] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setOffset(0);
  }, [debounced, estado]);

  const filters = useMemo(
    () => ({
      ...(debounced.trim() ? { search: debounced.trim() } : {}),
      ...(estado === "activas" ? { active: true as const } : {}),
      ...(estado === "inactivas" ? { active: false as const } : {}),
      limit: PAGE_SIZE,
      offset,
    }),
    [debounced, estado, offset],
  );

  const recipes = useRecipes(filters);
  // Se memoiza para que el efecto de selección no se dispare en cada render.
  const items = useMemo(() => recipes.data?.items ?? [], [recipes.data]);

  // Si la receta seleccionada desaparece del resultado, se elige la primera.
  useEffect(() => {
    if (!items.length) return;
    if (selectedId === null || !items.some((r) => r.id === selectedId)) {
      setSelectedId(items[0]!.id);
    }
  }, [items, selectedId]);

  const selected = items.find((r) => r.id === selectedId) ?? null;

  const seleccionar = (recipe: RecipeOut) => {
    setSelectedId(recipe.id);
    setMobileDetail(true);
  };

  return (
    <div className="space-y-4">
      {/* Filtros reales: solo lo que el backend sabe filtrar. */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre o referencia…"
            label="Buscar recetas"
          />
        </div>
        <SelectField
          label="Estado"
          value={estado}
          options={ESTADO_OPCIONES}
          onChange={setEstado}
          className="w-40"
        />
        {recipes.isFetching ? (
          <span className="pb-2 text-xs text-zinc-400">
            <Spinner className="size-3" label="Buscando…" />
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Lista */}
        <section
          className={[
            "xl:col-span-5 rounded-2xl border border-zinc-200 bg-white/70",
            mobileDetail ? "hidden xl:block" : "block",
          ].join(" ")}
        >
          <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Recetas{recipes.data ? ` (${recipes.data.total})` : ""}
            </h2>
          </header>

          {recipes.isPending ? (
            <div className="flex justify-center py-12">
              <Spinner className="size-5" label="Cargando recetas…" />
            </div>
          ) : recipes.isError ? (
            <p role="alert" className="py-12 text-center text-sm text-red-600">
              {describeError(recipes.error)}
            </p>
          ) : items.length === 0 ? (
            <EmptyState message="No hay recetas que coincidan con la búsqueda." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Referencia</th>
                    <th className="px-3 py-2 font-semibold">Nombre</th>
                    <th className="px-3 py-2 text-right font-semibold">Ver.</th>
                    <th className="px-3 py-2 text-right font-semibold">Rendim.</th>
                    <th className="px-3 py-2 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {items.map((recipe) => {
                    const active = recipe.id === selectedId;
                    return (
                      <tr
                        key={recipe.id}
                        onClick={() => seleccionar(recipe)}
                        aria-selected={active}
                        className={[
                          "cursor-pointer border-l-[3px] transition-colors",
                          active
                            ? "border-l-zinc-900 bg-zinc-50"
                            : "border-l-transparent hover:bg-zinc-50/60",
                        ].join(" ")}
                      >
                        <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">
                          {recipe.product_internal_reference}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              seleccionar(recipe);
                            }}
                            className="text-left font-medium text-zinc-900 hover:underline"
                          >
                            {recipe.name}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                          {recipe.current_version ? `v${recipe.current_version.version_number}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                          {recipe.current_version
                            ? `×${formatDecimal(recipe.current_version.yield_factor, 4)}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2">{estadoBadge(recipe)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {recipes.data && items.length > 0 ? (
            <div className="border-t border-zinc-100 px-3 py-2">
              <Pagination
                total={recipes.data.total}
                limit={PAGE_SIZE}
                offset={offset}
                onOffsetChange={setOffset}
              />
            </div>
          ) : null}
        </section>

        {/* Detalle */}
        <section
          className={[
            "xl:col-span-7 rounded-2xl border border-zinc-200 bg-white/70 p-4 sm:p-5",
            mobileDetail ? "block" : "hidden xl:block",
          ].join(" ")}
        >
          {selected ? (
            <RecipeDetailPanel
              recipeId={selected.id}
              canEdit={canEdit}
              onNewVersion={() => onNewVersion(selected)}
              onSimulate={(versionId) => onSimulate(selected, versionId)}
              onBack={() => setMobileDetail(false)}
            />
          ) : (
            <p className="py-16 text-center text-sm text-zinc-500">
              Seleccione una receta para ver su composición.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
