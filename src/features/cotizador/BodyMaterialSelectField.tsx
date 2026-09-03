/**
 * Selector del material que forma el cuerpo de la pieza.
 *
 * Muestra lo que el taller nombra —código y nombre del material— y no la
 * fórmula con la que se fabrica. Quien cotiza una jarra sabe que lleva
 * barbotina blanca; no tiene por qué saber de qué receta salió esa barbotina.
 * Esa procedencia se enseña aparte y de sólo lectura.
 *
 * Pagina en el servidor por el mismo motivo que el selector de recetas: un
 * límite que hoy se cumple por poco deja de cumplirse sin avisar. Qué
 * materiales son elegibles lo decide el backend; aquí no se filtra por tipo.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { fetchBodyMaterials } from "@/api/quotationBuilder";
import { Spinner } from "@/components/Spinner";
import type { BodyMaterialOptionOut } from "@/types/quotationBuilder";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 250;

interface BodyMaterialSelectFieldProps {
  label: string;
  requirement?: "required" | "optional" | undefined;
  /** Identificador del material elegido, como texto. */
  value: string;
  /** Etiqueta del elegido, para no perderla al cambiar de página. */
  selectedLabel?: string | undefined;
  onChange: (value: string, material?: BodyMaterialOptionOut) => void;
  hint?: string | undefined;
  disabled?: boolean | undefined;
}

const materialLabel = (material: BodyMaterialOptionOut) =>
  `${material.internal_reference} · ${material.name}`;

export function BodyMaterialSelectField({
  label,
  requirement,
  value,
  selectedLabel,
  onChange,
  hint,
  disabled = false,
}: BodyMaterialSelectFieldProps) {
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

  const consulta = useInfiniteQuery({
    queryKey: ["body-material-select", termino],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchBodyMaterials({
        ...(termino ? { search: termino } : {}),
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

  const mostrado = value ? items.find((m) => String(m.product_id) === value) : undefined;
  const textoBoton = mostrado ? materialLabel(mostrado) : selectedLabel || "Elegir material";

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
                placeholder="Buscar por nombre o código…"
                aria-label="Buscar material"
                className="h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm focus:border-zinc-900 focus:outline-none"
              />
            </div>

            <ul role="listbox" aria-label={label} className="max-h-64 overflow-y-auto p-1">
              {consulta.isPending ? (
                <li className="flex justify-center py-6">
                  <Spinner className="size-4" label="Buscando materiales…" />
                </li>
              ) : items.length === 0 ? (
                <li className="px-3 py-4 text-center text-xs text-zinc-400">
                  No se encontraron materiales.
                </li>
              ) : (
                items.map((material) => (
                  <li
                    key={material.product_id}
                    role="option"
                    aria-selected={String(material.product_id) === value}
                    onClick={() => {
                      onChange(String(material.product_id), material);
                      setAbierto(false);
                      setBusqueda("");
                    }}
                    className={[
                      "cursor-pointer rounded-lg px-3 py-2 text-sm",
                      String(material.product_id) === value
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-800 hover:bg-zinc-100",
                    ].join(" ")}
                  >
                    <span className="block truncate">{materialLabel(material)}</span>
                    <span
                      className={[
                        "mt-0.5 block text-[11px]",
                        String(material.product_id) === value ? "text-zinc-300" : "text-zinc-500",
                      ].join(" ")}
                    >
                      {material.uom ? `Se mide en ${material.uom}` : "Sin unidad registrada"}
                      {/* Se listan también los que no se pueden costear: no
                          verlos dejaría al usuario buscando algo que existe. */}
                      {material.costable ? "" : " · sin costo registrado"}
                    </span>
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
