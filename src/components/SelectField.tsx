import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  label: string;
  requirement?: "required" | "optional" | "automatic" | undefined;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
  searchable?: boolean | undefined;
  searchPlaceholder?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  className?: string | undefined;
}

export function SelectField<T extends string>({
  label,
  requirement,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Seleccionar...",
  searchable = true, // Mini buscador habilitado por defecto para todos los selects
  searchPlaceholder = "Buscar opción...",
  hint,
  error,
  className = "",
}: SelectFieldProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const id = useId();
  const listboxId = `${id}-listbox`;

  const selectedOption = options.find((opt) => opt.value === value);

  // Mostrar buscador si está habilitado y hay más de 2 opciones
  const showSearch = searchable && options.length > 2;

  // Filtrado local para modo búsqueda
  const filteredOptions = showSearch && search.trim() !== ""
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase().trim()),
      )
    : options;

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  // Enfocar buscador o resaltar opción actual al abrir
  useEffect(() => {
    if (isOpen) {
      if (showSearch) {
        const timer = setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
        return () => clearTimeout(timer);
      } else {
        const idx = filteredOptions.findIndex((opt) => opt.value === value);
        setHighlightedIndex(idx >= 0 ? idx : 0);
      }
    }
  }, [isOpen, showSearch, value, filteredOptions]);

  // Asegurar que la opción resaltada sea visible en el scroll
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
      setSearch("");
      triggerRef.current?.focus();
    } else {
      setIsOpen(true);
      setSearch("");
      const idx = options.findIndex((opt) => opt.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  };

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch("");
    triggerRef.current?.focus();
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
            prev < filteredOptions.length - 1 ? prev + 1 : prev,
          );
        }
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setHighlightedIndex(filteredOptions.length - 1);
        } else {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        }
        break;
      }
      case "Enter": {
        if (!isOpen) {
          event.preventDefault();
          setIsOpen(true);
        } else if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          event.preventDefault();
          const targetOpt = filteredOptions[highlightedIndex];
          if (targetOpt) {
            handleSelect(targetOpt.value);
          }
        }
        break;
      }
      case "Escape": {
        if (isOpen) {
          event.preventDefault();
          setIsOpen(false);
          setSearch("");
          triggerRef.current?.focus();
        }
        break;
      }
      case "Tab": {
        if (isOpen) {
          setIsOpen(false);
          setSearch("");
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
            {selectedOption ? selectedOption.label : (
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
          <div className="absolute left-0 right-0 z-40 mt-1.5 rounded-xl border border-zinc-200 bg-white p-1 shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100">
            {showSearch ? (
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
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setHighlightedIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={searchPlaceholder}
                    className="w-full h-8 pl-8 pr-3 text-xs bg-zinc-50 rounded-lg border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:border-zinc-900 focus:bg-white transition-colors"
                  />
                </div>
              </div>
            ) : null}

            <ul
              id={listboxId}
              ref={listboxRef}
              role="listbox"
              aria-label={label}
              className="max-h-64 sm:max-h-72 overflow-y-auto custom-scrollbar p-0.5 space-y-0.5"
            >
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-4 text-center text-xs text-zinc-400 select-none">
                  No se encontraron resultados
                </li>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <li
                      key={opt.value || `empty-${idx}`}
                      id={`${id}-opt-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt.value)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={[
                        "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer select-none",
                        isSelected
                          ? "bg-zinc-900 text-white font-medium"
                          : isHighlighted
                            ? "bg-zinc-100 text-zinc-900"
                            : "text-zinc-700 hover:bg-zinc-50",
                      ].join(" ")}
                    >
                      <span className="truncate">{opt.label}</span>

                      {isSelected ? (
                        <svg
                          className="size-4 shrink-0 text-white ml-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : null}
                    </li>
                  );
                })
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
