/**
 * Piezas compartidas de los maestros: cabecera compacta, tabla, paginacion.
 *
 * Se extraen aqui para que Productos, Terceros e Inventario se vean como el
 * mismo producto y no como tres pantallas escritas por separado.
 */

import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  subtitle: string;
  actions?: ReactNode;
}

export function MasterHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {title}
        <p className="mt-1 text-xs sm:text-sm text-zinc-500">{subtitle}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}

export function SearchInput({ value, onChange, placeholder, label }: SearchInputProps) {
  return (
    <input
      type="search"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full sm:w-72 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
    />
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 border-b border-zinc-200 pb-4">
      {children}
    </div>
  );
}

export function TableWrapper({ children }: { children: ReactNode }) {
  // El scroll horizontal vive en la tabla, no en la pagina.
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-zinc-200 pb-2 pr-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  muted = false,
  mono = false,
}: {
  children: ReactNode;
  align?: "left" | "right";
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      className={`border-b border-zinc-100 py-2 pr-4 ${align === "right" ? "text-right" : ""} ${
        muted ? "text-zinc-500" : "text-zinc-800"
      } ${mono ? "font-mono text-xs" : ""}`}
    >
      {children}
    </td>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-zinc-100 text-zinc-600",
    positive: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
}

export function Pagination({ total, limit, offset, onOffsetChange }: PaginationProps) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
          disabled={offset === 0}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onOffsetChange(offset + limit)}
          disabled={to >= total}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-zinc-500">{message}</p>;
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="glass-panel w-full rounded-2xl border border-white/60 p-5 shadow-lg sm:rounded-3xl sm:p-6">
      {children}
    </div>
  );
}
