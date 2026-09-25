import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchPartners } from "@/api/masters";
import { Field } from "@/components/form";
import type { Partner } from "@/types/masters";

const PAGE_SIZE = 20;

interface CustomerOption {
  id: number | null;
  label: string;
  partner?: Partner;
}

export interface CustomerSelectFieldProps {
  label: string;
  value: number | null;
  onChange: (customerId: number | null, partner?: Partner | null) => void;
  selectedLabel?: string;
  selectedPartner?: Partner | null;
  disabled?: boolean;
  requirement?: "required" | "optional" | "automatic";
  placeholder?: string;
  searchPlaceholder?: string;
  hint?: string;
  error?: string;
  className?: string;
}

function labelForPartner(partner: Partner): string {
  return partner.document_number
    ? `${partner.name} · ${partner.document_number}`
    : partner.name;
}

/** Selector con búsqueda en servidor para terceros con rol de cliente. */
export function CustomerSelectField({
  label,
  value,
  onChange,
  selectedLabel,
  selectedPartner,
  disabled = false,
  requirement = "optional",
  placeholder = "Seleccionar cliente...",
  searchPlaceholder = "Buscar por nombre o documento...",
  hint,
  error,
  className,
}: CustomerSelectFieldProps) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [labelCache, setLabelCache] = useState<Record<number, string>>({});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const customersQuery = useQuery({
    queryKey: ["partners", "customer-select", debouncedSearch],
    enabled: isOpen,
    queryFn: async () => {
      const filters = {
        search: debouncedSearch,
        active: true,
        limit: PAGE_SIZE,
        offset: 0,
      };
      // El filtro de rol de la API acepta un solo valor. Se consultan CLIENT y
      // BOTH en paralelo para que un proveedor puro nunca aparezca como cliente.
      const [clientes, mixtos] = await Promise.all([
        fetchPartners({ ...filters, role: "CLIENT" }),
        fetchPartners({ ...filters, role: "BOTH" }),
      ]);
      const unicos = new Map<number, Partner>();
      for (const partner of [...clientes.items, ...mixtos.items]) {
        if (partner.active && (partner.role === "CLIENT" || partner.role === "BOTH")) {
          unicos.set(partner.id, partner);
        }
      }
      return [...unicos.values()].slice(0, PAGE_SIZE);
    },
  });

  const partners = useMemo(() => customersQuery.data ?? [], [customersQuery.data]);
  useEffect(() => {
    if (partners.length === 0) return;
    setLabelCache((actual) => {
      const siguiente = { ...actual };
      for (const partner of partners) siguiente[partner.id] = labelForPartner(partner);
      return siguiente;
    });
  }, [partners]);

  const partnerSeleccionado =
    partners.find((partner) => partner.id === value) ??
    (selectedPartner?.id === value ? selectedPartner : null);
  const labelSeleccionado =
    value === null
      ? ""
      : partnerSeleccionado
        ? labelForPartner(partnerSeleccionado)
        : labelCache[value] ?? selectedLabel ?? `Cliente #${value}`;

  const haySeleccionEnPagina = value !== null && partners.some((partner) => partner.id === value);
  const options: CustomerOption[] = [
    ...(value !== null ? [{ id: null, label: "Sin cliente" }] : []),
    ...(value !== null && !haySeleccionEnPagina
      ? [
          {
            id: value,
            label: labelSeleccionado,
            ...(selectedPartner?.id === value ? { partner: selectedPartner } : {}),
          },
        ]
      : []),
    ...partners.map((partner) => ({
      id: partner.id,
      label: labelForPartner(partner),
      partner,
    })),
  ];

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOutside = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setSearch("");
        setDebouncedSearch("");
        setHighlightedIndex(0);
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("touchstart", closeOutside);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("touchstart", closeOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [debouncedSearch, customersQuery.data]);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !listboxRef.current) return;
    const option = listboxRef.current.children[highlightedIndex] as HTMLElement | undefined;
    if (option && typeof option.scrollIntoView === "function") {
      option.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen, options.length]);

  const close = (restoreFocus: boolean) => {
    setSearch("");
    setDebouncedSearch("");
    setHighlightedIndex(0);
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const selectOption = (option: CustomerOption) => {
    if (option.id !== null && option.partner) {
      setLabelCache((actual) => ({ ...actual, [option.id as number]: option.label }));
    }
    onChange(option.id, option.partner ?? (option.id === value ? selectedPartner : null));
    setSearch("");
    close(true);
  };

  const toggleOpen = () => {
    if (disabled) return;
    if (isOpen) {
      close(true);
    } else {
      setHighlightedIndex(0);
      setIsOpen(true);
    }
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex(0);
      setIsOpen(true);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleOpen();
    } else if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      close(true);
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((current) => Math.min(current + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((current) => Math.max(current - 1, 0));
        break;
      case "Enter": {
        event.preventDefault();
        const option = options[highlightedIndex];
        if (option) selectOption(option);
        break;
      }
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
      default:
        break;
    }
  };

  return (
    <Field label={label} requirement={requirement} hint={hint} error={error} className={className}>
      {(fieldId) => (
        <div ref={rootRef} className="relative mt-1">
          <button
            id={fieldId}
            ref={triggerRef}
            type="button"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            aria-label={label}
            aria-invalid={error ? true : undefined}
            aria-activedescendant={
              isOpen && !customersQuery.isPending && !customersQuery.isError && options[highlightedIndex]
                ? `${id}-option-${highlightedIndex}`
                : undefined
            }
            disabled={disabled}
            onClick={toggleOpen}
            onKeyDown={handleTriggerKeyDown}
            className={[
              "w-full h-10 px-3 rounded-xl border bg-white/55 backdrop-blur-xs text-xs sm:text-sm text-left flex items-center justify-between gap-2 transition-all duration-150",
              error
                ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                : "border-black/[0.08] hover:border-black/20 focus:border-black focus:ring-1 focus:ring-black",
              disabled
                ? "bg-white/30 text-zinc-400 cursor-not-allowed border-black/[0.04] shadow-none opacity-50"
                : "text-zinc-900 shadow-2xs cursor-pointer",
              isOpen ? "border-black ring-1 ring-black bg-white/80" : "",
            ].join(" ")}
          >
            <span className={labelSeleccionado ? "truncate" : "truncate text-zinc-400"}>
              {labelSeleccionado || placeholder}
            </span>
            <span aria-hidden="true" className="text-zinc-400">
              {isOpen ? "⌃" : "⌄"}
            </span>
          </button>

          {isOpen && !disabled ? (
            <div className="absolute left-0 right-0 z-50 mt-1.5 rounded-2xl border border-white/60 bg-white/95 backdrop-blur-xl p-1.5 shadow-2xl ring-1 ring-black/5 min-w-[280px]">
              <div className="p-1 border-b border-black/[0.04] mb-1">
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={searchPlaceholder}
                  aria-label={`Buscar ${label.toLocaleLowerCase()}`}
                  aria-controls={listboxId}
                  className="w-full h-8 px-3 text-xs bg-white/60 rounded-xl border border-black/[0.08] text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:border-black focus:bg-white transition-colors"
                />
              </div>

              <ul
                id={listboxId}
                ref={listboxRef}
                role="listbox"
                aria-label={`Opciones de ${label.toLocaleLowerCase()}`}
                className="max-h-60 sm:max-h-72 overflow-y-auto custom-scrollbar p-0.5 space-y-0.5"
              >
                {customersQuery.isPending ? (
                  <li role="presentation" className="px-3 py-6 text-center text-xs text-zinc-500">
                    <span role="status">Cargando clientes...</span>
                  </li>
                ) : customersQuery.isError ? (
                  <li role="presentation" className="px-3 py-4 text-center text-xs text-red-600">
                    <p role="alert">No se pudieron cargar los clientes.</p>
                    <button
                      type="button"
                      onClick={() => void customersQuery.refetch()}
                      className="mt-2 inline-flex items-center px-2 py-1 text-[11px] font-medium bg-red-50 text-red-700 rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
                    >
                      Reintentar
                    </button>
                  </li>
                ) : (
                  <>
                    {partners.length === 0 ? (
                      <li role="presentation" className="px-3 py-4 text-center text-xs text-zinc-500">
                        {debouncedSearch
                          ? `No se encontraron clientes para “${debouncedSearch}”.`
                          : "No hay clientes disponibles."}
                      </li>
                    ) : null}
                    {options.map((option, index) => (
                      <li
                        key={option.id ?? "clear"}
                        id={`${id}-option-${index}`}
                        role="option"
                        aria-selected={option.id === value}
                        onClick={() => selectOption(option)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={[
                          "flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer select-none",
                          option.id === value
                            ? "bg-black text-white font-semibold shadow-2xs"
                            : index === highlightedIndex
                              ? "bg-black/[0.04] text-zinc-900"
                              : "text-zinc-700 hover:bg-black/[0.03]",
                        ].join(" ")}
                      >
                        <span className="truncate">{option.label}</span>
                        {option.id === value ? (
                          <span aria-hidden="true" className="ml-2 shrink-0">
                            ✓
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </>
                )}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </Field>
  );
}
