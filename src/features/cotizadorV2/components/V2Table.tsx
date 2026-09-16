import type { ReactNode } from 'react';

export function TableWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = 'left',
  className = '',
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  const base = "whitespace-nowrap border-b border-zinc-200 pb-2 pr-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
  const alignClass = align === "right" ? "text-right" : "";
  return (
    <th scope="col" className={[base, alignClass, className].filter(Boolean).join(" ")}>
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  muted = false,
  mono = false,
  className = '',
  colSpan,
}: {
  children: ReactNode;
  align?: 'left' | 'right';
  muted?: boolean;
  mono?: boolean;
  className?: string;
  colSpan?: number;
}) {
  const base = "border-b border-zinc-100 py-2 pr-4";
  const alignClass = align === "right" ? "text-right" : "";
  const mutedClass = muted ? "text-zinc-500" : "text-zinc-800";
  const monoClass = mono ? "font-mono text-xs" : "";
  return (
    <td colSpan={colSpan} className={[base, alignClass, mutedClass, monoClass, className].filter(Boolean).join(" ")}>
      {children}
    </td>
  );
}
