/**
 * Selector remoto de recetas, con paginación real.
 *
 * Busca y pagina en el servidor en lugar de descargar el catálogo entero. Hoy
 * hay 93 recetas y cabrían en una sola petición, pero un límite que se cumple
 * por poco no es un límite: el día que pasen del tope el selector dejaría de
 * ofrecer las últimas sin que nada avisara.
 *
 * Por el mismo motivo la paginación es dinámica y no un puñado de consultas
 * fijas: encadenar tres páginas resuelve hasta ciento cincuenta resultados y
 * vuelve a fallar en silencio en la ciento cincuenta y uno.
 *
 * Se mantiene aparte del selector de recetas de Fase 003.5 a propósito: aquel
 * funciona y no hay motivo para arriesgarlo por esto.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { fetchRecipes } from "@/api/recipes";
import { Spinner } from "@/components/Spinner";
import type { RecipeOut } from "@/types/recipes";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 250;

interface RecipeSelectFieldProps {
  label: string;
  requirement?: "required" | "optional" | "automatic" | undefined;
  /** Identificador de la receta elegida, como texto. */
  value: string;
  /** Etiqueta de la elegida, para no perderla al cambiar de página. */
  selectedLabel?: string | undefined;
  onChange: (value: string, recipe?: RecipeOut) => void;
  hint?: string | undefined;
  disabled?: boolean | undefined;
}

const etiqueta = (recipe: RecipeOut) =>
  `${recipe.product_internal_reference} · ${recipe.name}`;

export function RecipeSelectField({
  label,
  requirement,
  value,
  selectedLabel,
  onChange,
  hint,
  disabled = false,
}: RecipeSelectFieldProps) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [debounced, setDebounced] = useState("");
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(busqueda), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [busqueda]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (evento: MouseEvent) => {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const termino = debounced.trim();

  // La búsqueda forma parte de la clave, así que cambiarla empieza una
  // paginación nueva desde el primer resultado en lugar de mezclarse con la
  // anterior.
  const consulta = useInfiniteQuery({
    queryKey: ["recipe-select", termino],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchRecipes({
        ...(termino ? { search: termino } : {}),
        active: true,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (ultima, todas) => {
      const cargadas = todas.reduce((suma, pagina) => suma + pagina.items.length, 0);
      return cargadas < ultima.total ? cargadas : undefined;
    },
    enabled: abierto,
  });

  const items = useMemo(
    () => consulta.data?.pages.flatMap((pagina) => pagina.items) ?? [],
    [consulta.data],
  );
  const total = consulta.data?.pages[0]?.total ?? 0;

  const mostrado = value ? items.find((r) => String(r.id) === value) : undefined;
  const textoBoton = mostrado ? etiqueta(mostrado) : selectedLabel || "Elegir receta";

  return (
    <div className={`w-full ${disabled ? "opacity-60" : ""}`} ref={contenedor}>
      <label className="mb-1.5 block text-xs font-medium text-zinc-700">
        {label}
        {requirement === "required" ? (
          <span className="ml-1 text-red-600">* Obligatorio</span>
        ) : null}
      </label>

      <div className="relative">
        <button
          type="button"
          role="combobox"
          aria-expanded={abierto}
          aria-haspopup="listbox"
          aria-label={label}
          disabled={disabled}
          onClick={() => setAbierto((previo) => !previo)}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-left text-sm transition-colors hover:border-zinc-300 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        >
          <span
            className={
              mostrado || selectedLabel ? "truncate text-zinc-900" : "truncate text-zinc-400"
            }
          >
            {textoBoton}
          </span>
          <span aria-hidden="true" className="text-zinc-400">
            ▾
          </span>
        </button>

        {abierto ? (
          <div className="absolute z-30 mt-1 w-full rounded-xl border border-zinc-200 bg-white shadow-lg">
            <div className="border-b border-zinc-100 p-2">
              <input
                type="search"
                autoFocus
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar por nombre o referencia…"
                aria-label="Buscar receta"
                className="h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm focus:border-zinc-900 focus:outline-none"
              />
            </div>

            <ul role="listbox" aria-label={label} className="max-h-64 overflow-y-auto p-1">
              {consulta.isPending ? (
                <li className="flex justify-center py-6">
                  <Spinner className="size-4" label="Buscando recetas…" />
                </li>
              ) : items.length === 0 ? (
                <li className="px-3 py-4 text-center text-xs text-zinc-400">
                  No se encontraron recetas.
                </li>
              ) : (
                items.map((recipe) => (
                  <li
                    key={recipe.id}
                    role="option"
                    aria-selected={String(recipe.id) === value}
                    onClick={() => {
                      onChange(String(recipe.id), recipe);
                      setAbierto(false);
                      setBusqueda("");
                    }}
                    className={[
                      "cursor-pointer rounded-lg px-3 py-2 text-sm",
                      String(recipe.id) === value
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-800 hover:bg-zinc-100",
                    ].join(" ")}
                  >
                    {etiqueta(recipe)}
                  </li>
                ))
              )}
            </ul>

            {consulta.hasNextPage ? (
              <div className="border-t border-zinc-100 p-2">
                <button
                  type="button"
                  disabled={consulta.isFetchingNextPage}
                  onClick={() => void consulta.fetchNextPage()}
                  className="w-full rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                >
                  {consulta.isFetchingNextPage
                    ? "Cargando…"
                    : `Ver más (${items.length} de ${total})`}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {hint ? <p className="mt-1 text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}
