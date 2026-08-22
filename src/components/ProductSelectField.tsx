/**
 * Selector de productos con búsqueda remota y paginación en servidor.
 *
 * Diseñado para catálogos que pueden contener cientos o miles de productos:
 * - Carga inicial paginada (limit=50, offset=0).
 * - Búsqueda en servidor con debounce (250ms) por nombre o referencia.
 * - Soporte para "Cargar más" sin perder la selección actual.
 * - Cero selects nativos, soporte completo de teclado y accesibilidad ARIA.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchProducts } from "@/api/masters";
import { PRODUCTS_KEY } from "@/features/masters/useMasters";
import type { Product, ProductType } from "@/types/masters";

export interface ProductSelectOption {
  value: string;
  label: string;
  product?: Product;
}

interface ProductSelectFieldProps {
  label: string;
  requirement?: "required" | "optional" | "automatic" | undefined;
  value: string;
  onChange: (value: string, product?: Product) => void;
  selectedLabel?: string | undefined;
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
  searchPlaceholder?: string | undefined;
  productType?: ProductType | undefined;
  activeOnly?: boolean | undefined;
  excludeIds?: number[] | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  className?: string | undefined;
}

const PAGE_SIZE = 50;

export function ProductSelectField({
  label,
  requirement,
  value,
  onChange,
  selectedLabel,
  disabled = false,
  placeholder = "Seleccionar componente...",
  searchPlaceholder = "Buscar por nombre o referencia (ej. Carbonato, LAB70...)",
  productType,
  activeOnly = true,
  excludeIds = [],
  hint,
  error,
  className = "",
}: ProductSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [accumulatedProducts, setAccumulatedProducts] = useState<Product[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [labelCache, setLabelCache] = useState<Record<string, string>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const id = useId();
  const listboxId = `${id}-listbox`;

  // Debounce de búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0); // Reiniciar paginación al cambiar búsqueda
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Consulta al servidor mediante TanStack Query
  const queryParams = useMemo(
    () => ({
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(productType ? { product_type: productType } : {}),
      ...(activeOnly ? { active: true as const } : {}),
      limit: PAGE_SIZE,
      offset,
    }),
    [debouncedSearch, productType, activeOnly, offset],
  );

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: [...PRODUCTS_KEY, "remote-picker", queryParams],
    queryFn: () => fetchProducts(queryParams),
    staleTime: 30_000,
  });

  // Acumular productos para paginación incremental
  useEffect(() => {
    if (data?.items) {
      if (offset === 0) {
        setAccumulatedProducts(data.items);
      } else {
        setAccumulatedProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newItems = data.items.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newItems];
        });
      }
      // Actualizar cache de labels
      setLabelCache((prev) => {
        const next = { ...prev };
        data.items.forEach((p) => {
          next[String(p.id)] = `${p.internal_reference} · ${p.name}`;
        });
        return next;
      });
    }
  }, [data, offset]);

  // Filtrar productos excluidos (ej. ciclo directo)
  const availableProducts = useMemo(() => {
    if (!excludeIds.length) return accumulatedProducts;
    const excludedSet = new Set(excludeIds);
    return accumulatedProducts.filter((p) => !excludedSet.has(p.id));
  }, [accumulatedProducts, excludeIds]);

  const totalCount = data?.total ?? 0;
  const hasMore = availableProducts.length < totalCount;

  // Determinar el label a mostrar
  const displayLabel = useMemo(() => {
    if (!value) return null;
    if (selectedLabel) return selectedLabel;
    if (labelCache[value]) return labelCache[value];
    const found = availableProducts.find((p) => String(p.id) === value);
    if (found) return `${found.internal_reference} · ${found.name}`;
    return null;
  }, [value, selectedLabel, labelCache, availableProducts]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  // Foco al abrir
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Asegurar visibilidad del elemento resaltado
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !listboxRef.current) return;
    const item = listboxRef.current.children[highlightedIndex] as HTMLElement;
    if (item && typeof item.scrollIntoView === "function") {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  const toggleOpen = () => {
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
      triggerRef.current?.focus();
    } else {
      setIsOpen(true);
      setHighlightedIndex(0);
    }
  };

  const handleSelect = (prod: Product) => {
    const strVal = String(prod.id);
    const lbl = `${prod.internal_reference} · ${prod.name}`;
    setLabelCache((prev) => ({ ...prev, [strVal]: lbl }));
    onChange(strVal, prod);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleLoadMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isFetching && hasMore) {
      setOffset((prev) => prev + PAGE_SIZE);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (disabled) return;

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setHighlightedIndex(0);
        } else {
          setHighlightedIndex((prev) =>
            prev < availableProducts.length - 1 ? prev + 1 : prev,
          );
        }
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setHighlightedIndex(availableProducts.length - 1);
        } else {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        }
        break;
      }
      case "Enter": {
        if (!isOpen) {
          event.preventDefault();
          setIsOpen(true);
        } else if (
          highlightedIndex >= 0 &&
          highlightedIndex < availableProducts.length
        ) {
          event.preventDefault();
          const target = availableProducts[highlightedIndex];
          if (target) {
            handleSelect(target);
          }
        }
        break;
      }
      case "Escape": {
        if (isOpen) {
          event.preventDefault();
          setIsOpen(false);
          triggerRef.current?.focus();
        }
        break;
      }
      case "Tab": {
        if (isOpen) {
          setIsOpen(false);
        }
        break;
      }
      default:
        break;
    }
  };

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="flex items-baseline justify-between gap-2 text-xs font-medium text-zinc-700"
      >
        <span>{label}</span>
        {requirement ? (
          <span
            className={
              requirement === "required"
                ? "text-orange-600 font-semibold"
                : "font-normal text-zinc-400"
            }
          >
            {requirement === "required"
              ? "* Obligatorio"
              : requirement === "optional"
                ? "Opcional"
                : "Automático"}
          </span>
        ) : null}
      </label>

      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        className="relative mt-1"
      >
        {/* Trigger Button */}
        <button
          id={id}
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          onClick={toggleOpen}
          className={[
            "w-full h-10 px-3 rounded-xl border bg-white text-sm text-left flex items-center justify-between gap-2 transition-all duration-150",
            error
              ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
              : "border-zinc-200 hover:border-zinc-300 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900",
            disabled
              ? "bg-zinc-50 text-zinc-400 cursor-not-allowed border-zinc-200 shadow-none opacity-60"
              : "text-zinc-900 shadow-xs cursor-pointer",
            isOpen ? "border-zinc-900 ring-1 ring-zinc-900" : "",
          ].join(" ")}
        >
          <span className="truncate">
            {displayLabel ? (
              displayLabel
            ) : (
              <span className="text-zinc-400">{placeholder}</span>
            )}
          </span>

          <svg
            className={[
              "size-4 shrink-0 text-zinc-400 transition-transform duration-200",
              isOpen ? "rotate-180 text-zinc-700" : "",
            ].join(" ")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && !disabled ? (
          <div className="absolute left-0 right-0 z-50 mt-1.5 rounded-xl border border-zinc-200 bg-white p-1 shadow-2xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100 min-w-[280px]">
            {/* Buscador Integrado */}
            <div className="p-1.5 border-b border-zinc-100 mb-1">
              <div className="relative flex items-center">
                <svg
                  className="absolute left-2.5 size-3.5 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full h-8 pl-8 pr-7 text-xs bg-zinc-50 rounded-lg border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:border-zinc-900 focus:bg-white transition-colors"
                />
                {isFetching ? (
                  <span className="absolute right-2.5 size-3 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                ) : null}
              </div>
            </div>

            {/* Lista de Opciones */}
            <ul
              id={listboxId}
              ref={listboxRef}
              role="listbox"
              aria-label={label}
              className="max-h-60 sm:max-h-72 overflow-y-auto custom-scrollbar p-0.5 space-y-0.5"
            >
              {isLoading && offset === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2 select-none">
                  <span className="size-4 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
                  <span>Cargando productos...</span>
                </li>
              ) : isError ? (
                <li className="px-3 py-4 text-center text-xs text-red-600 select-none space-y-2">
                  <p>No se pudieron cargar los componentes</p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="inline-flex items-center px-2 py-1 text-[11px] font-medium bg-red-50 text-red-700 rounded border border-red-200 hover:bg-red-100 transition-colors"
                  >
                    Reintentar
                  </button>
                </li>
              ) : availableProducts.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-zinc-400 select-none">
                  {debouncedSearch ? (
                    <span>
                      No se encontraron resultados para &ldquo;{debouncedSearch}&rdquo;
                    </span>
                  ) : (
                    <span>No hay productos disponibles</span>
                  )}
                </li>
              ) : (
                <>
                  {availableProducts.map((p, idx) => {
                    const isSelected = String(p.id) === value;
                    const isHighlighted = idx === highlightedIndex;

                    return (
                      <li
                        key={p.id}
                        id={`${id}-opt-${idx}`}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(p)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={[
                          "flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors cursor-pointer select-none",
                          isSelected
                            ? "bg-zinc-900 text-white font-medium"
                            : isHighlighted
                              ? "bg-zinc-100 text-zinc-900"
                              : "text-zinc-700 hover:bg-zinc-50",
                        ].join(" ")}
                      >
                        <div className="flex items-baseline gap-1.5 truncate">
                          <span
                            className={[
                              "font-mono text-[11px] font-semibold shrink-0",
                              isSelected ? "text-zinc-300" : "text-zinc-500",
                            ].join(" ")}
                          >
                            {p.internal_reference}
                          </span>
                          <span className="truncate">{p.name}</span>
                        </div>

                        {isSelected ? (
                          <svg
                            className="size-4 shrink-0 text-white ml-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2.5"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : null}
                      </li>
                    );
                  })}

                  {/* Botón Cargar Más */}
                  {hasMore ? (
                    <li className="p-1 text-center">
                      <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={isFetching}
                        className="w-full py-1.5 text-xs text-zinc-600 bg-zinc-50 hover:bg-zinc-100 rounded-md border border-zinc-200 transition-colors flex items-center justify-center gap-1.5"
                      >
                        {isFetching ? (
                          <>
                            <span className="size-3 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                            <span>Cargando más...</span>
                          </>
                        ) : (
                          <span>
                            Ver más ({availableProducts.length} de {totalCount})
                          </span>
                        )}
                      </button>
                    </li>
                  ) : null}
                </>
              )}
            </ul>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}
