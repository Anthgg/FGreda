import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import { useAuditEvents } from "@/features/settings/useSettings";

const ENTIDADES: Record<string, string> = {
  company_settings: "Empresa",
  commercial_settings: "Comercial",
  bank_account: "Cuenta bancaria",
  document_sequence: "Numeración",
};

function formatDate(value: string): string {
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? value : fecha.toLocaleString("es-PE");
}

function Valor({ children }: { children: string | null }) {
  if (children === null) {
    return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  }
  return <span className="break-words font-medium">{children}</span>;
}

/** Historial de cambios de configuración. Reservado a ADMIN por el backend. */
export function AuditSection({ canView }: { canView: boolean }) {
  const query = useAuditEvents(canView);

  if (!canView) {
    return (
      <p className="text-sm text-zinc-500">
        El historial de cambios está reservado a los administradores.
      </p>
    );
  }

  if (query.isPending) {
    return (
      <div className="py-8 text-center text-sm text-zinc-500">
        <Spinner className="size-5" label="Cargando historial de cambios..." />
      </div>
    );
  }

  if (query.isError) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        {describeError(query.error)}
      </p>
    );
  }

  if (!query.data.items.length) {
    return (
      <div className="py-8 text-center text-sm text-zinc-400">
        Todavía no se ha registrado ningún cambio de configuración.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-zinc-200/80 bg-white">
        <table className="w-full min-w-[48rem] text-sm text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Sección</th>
              <th className="px-4 py-3">Campo</th>
              <th className="px-4 py-3">Valor Anterior</th>
              <th className="px-4 py-3">Valor Nuevo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {query.data.items.map((evento) => (
              <tr key={evento.id} className="hover:bg-zinc-50/60 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-500">
                  {formatDate(evento.created_at)}
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-zinc-900">
                  {evento.user_display_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-600">
                  <span className="inline-block rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-700">
                    {ENTIDADES[evento.entity_type] ?? evento.entity_type}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                  {evento.field ?? evento.action}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  <Valor>{evento.old_value}</Valor>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-900">
                  <Valor>{evento.new_value}</Valor>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-400 text-right">
        Se muestran los {query.data.items.length} cambios más recientes de {query.data.total}.
      </p>
    </div>
  );
}
