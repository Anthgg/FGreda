/**
 * Lista de recetas del taller.
 *
 * Muestra solo recetas activas por defecto con opcion de ver todas.
 * Incluye acceso al importador de staging y creacion de recetas.
 * Utiliza formateo decimal basado en string sin conversiones IEEE-754.
 */

import { useState } from "react";

import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { useSession } from "@/features/auth/useSession";
import { describeError } from "@/features/settings/messages";
import {
  Badge,
  EmptyState,
  MasterHeader,
  Pagination,
  Panel,
  SearchInput,
  TableWrapper,
  Td,
  Th,
  Toolbar,
} from "@/features/masters/MasterTable";
import { formatDecimal } from "@/features/recipes/formatDecimal";
import { useRecipes } from "@/features/recipes/useRecipes";
import { RecipeDetailModal } from "@/features/recipes/RecipeDetailModal";
import { RecipeCreateModal } from "@/features/recipes/RecipeCreateModal";
import { RecipeImportModal } from "@/features/recipes/RecipeImportModal";
import type { RecipeOut } from "@/types/recipes";

const PAGE_SIZE = 25;

function statusBadge(recipe: RecipeOut) {
  if (!recipe.active)
    return <Badge tone="neutral">Inactiva</Badge>;
  if (!recipe.current_version_id)
    return <Badge tone="warning">Sin versión</Badge>;
  return <Badge tone="positive">Activa</Badge>;
}

export function RecipeListPage() {
  const { data: user } = useSession();
  const isAdmin = user?.role === "ADMIN";

  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  const recipes = useRecipes({
    ...(search ? { search } : {}),
    ...(showInactive ? {} : { active: true as const }),
    limit: PAGE_SIZE,
    offset,
  });

  return (
    <div className="space-y-4">
      <Panel>
        <MasterHeader
          title={
            <TypewriterTitle
              text="Recetas"
              className="text-xl sm:text-2xl font-semibold text-zinc-900"
            />
          }
          subtitle="Fórmulas y composiciones de materiales preparados del taller."
          actions={
            isAdmin ? (
              <div className="flex gap-2">
                <SecondaryButton onClick={() => setImporting(true)}>
                  Importar desde maestro
                </SecondaryButton>
                <PrimaryButton onClick={() => setCreating(true)}>
                  Nueva receta
                </PrimaryButton>
              </div>
            ) : undefined
          }
        />

        <Toolbar>
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setOffset(0); }}
            placeholder="Buscar por nombre o referencia…"
            label="Buscar recetas"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => { setShowInactive(e.target.checked); setOffset(0); }}
              className="rounded border-zinc-300"
            />
            Incluir inactivas
          </label>
        </Toolbar>

        {recipes.isLoading && (
          <div className="py-10 flex justify-center">
            <Spinner />
          </div>
        )}

        {recipes.isError && (
          <p className="py-10 text-center text-sm text-red-600">
            {describeError(recipes.error)}
          </p>
        )}

        {recipes.data && (
          <>
            <TableWrapper>
              <thead>
                <tr>
                  <Th>Referencia</Th>
                  <Th>Nombre de receta</Th>
                  <Th>Producto</Th>
                  <Th>Versión</Th>
                  <Th>Factor rendimiento</Th>
                  <Th>Estado</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {recipes.data.items.map((recipe) => (
                  <tr key={recipe.id} className="hover:bg-zinc-50">
                    <Td mono muted>{recipe.product_internal_reference}</Td>
                    <Td>{recipe.name}</Td>
                    <Td muted>{recipe.product_name}</Td>
                    <Td muted>
                      {recipe.current_version
                        ? `v${recipe.current_version.version_number}`
                        : "—"}
                    </Td>
                    <Td mono>
                      {recipe.current_version
                        ? `×${formatDecimal(recipe.current_version.yield_factor, 4)}`
                        : "—"}
                    </Td>
                    <Td>{statusBadge(recipe)}</Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setDetailId(recipe.id)}
                        className="text-xs text-zinc-500 hover:text-zinc-900 underline"
                      >
                        Ver detalle
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>

            {recipes.data.items.length === 0 && (
              <EmptyState message="No hay recetas que coincidan con los filtros." />
            )}

            <Pagination
              total={recipes.data.total}
              limit={PAGE_SIZE}
              offset={offset}
              onOffsetChange={setOffset}
            />
          </>
        )}
      </Panel>

      {detailId !== null && (
        <RecipeDetailModal recipeId={detailId} onClose={() => setDetailId(null)} />
      )}

      {creating && isAdmin && (
        <RecipeCreateModal onClose={() => setCreating(false)} />
      )}

      {importing && isAdmin && (
        <RecipeImportModal onClose={() => setImporting(false)} />
      )}
    </div>
  );
}
