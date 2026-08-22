import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import { useAuditEvents } from "@/features/settings/useSettings";

const ENTIDADES: Record<string, string> = {
  company_settings: "Empresa",
  commercial_settings: "Comercial",
  bank_account: "Cuenta bancaria",
  document_sequence: "Numeracion",
};

function formatDate(value: string): string {
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? value : fecha.toLocaleString();
}

function Valor({ children }: { children: string | null }) {
  if (children === null) {
    return <span className="text-zinc-400 dark:text-zinc-600">—</span>;
  }
  return <span className="break-words">{children}</span>;
}

/** Historial de cambios de configuracion. Reservado a ADMIN por el backend. */
export function AuditSection({ canView }: { canView: boolean }) {
  const query = useAuditEvents(canView);

  if (!canView) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        El historial de cambios esta reservado a los administradores.
      </p>
    );
  }

  if (query.isPending) {
    return (
      <p className="text-sm text-zinc-500">
        <Spinner className="size-3.5" label="Cargando historial..." />
      </p>
    );
  }

  if (query.isError) {
    return (
      <p
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      >
        {describeError(query.error)}
      </p>
    );
  }

  if (!query.data.items.length) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Todavia no se ha registrado ningun cambio de configuracion.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th className="py-2 pr-3 font-medium">Fecha</th>
            <th className="py-2 pr-3 font-medium">Usuario</th>
            <th className="py-2 pr-3 font-medium">Seccion</th>
            <th className="py-2 pr-3 font-medium">Campo</th>
            <th className="py-2 pr-3 font-medium">Anterior</th>
            <th className="py-2 font-medium">Nuevo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {query.data.items.map((evento) => (
            <tr key={evento.id} className="align-top">
              <td className="py-2 pr-3 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                {formatDate(evento.created_at)}
              </td>
              <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                {evento.user_display_name ?? "—"}
              </td>
              <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                {ENTIDADES[evento.entity_type] ?? evento.entity_type}
              </td>
              <td className="py-2 pr-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {evento.field ?? evento.action}
              </td>
              <td className="py-2 pr-3 text-zinc-500 dark:text-zinc-400">
                <Valor>{evento.old_value}</Valor>
              </td>
              <td className="py-2 text-zinc-900 dark:text-zinc-100">
                <Valor>{evento.new_value}</Valor>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        Se muestran los {query.data.items.length} cambios mas recientes de {query.data.total}.
      </p>
    </div>
  );
}
