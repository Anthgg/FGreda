import { useSession } from "@/features/auth/useSession";
import { NAVIGATION } from "@/layouts/navigation";

/**
 * Unica pantalla con contenido funcional de la Fase 1.
 *
 * Muestra la sesion resuelta por el backend y el estado de los modulos. No
 * calcula nada ni contiene logica de negocio.
 */
export function HomePage() {
  const { data: user } = useSession();
  const pendingModules = NAVIGATION.filter((item) => !item.enabled);

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Inicio
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {user ? `Sesion activa como ${user.display_name}.` : "Sesion activa."}
        </p>
      </header>

      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Sesion
        </h2>
        <dl className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Usuario</dt>
            <dd className="text-right text-zinc-900 dark:text-zinc-100">
              {user?.display_name ?? "-"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Correo</dt>
            <dd className="truncate text-right text-zinc-900 dark:text-zinc-100">
              {user?.email ?? "-"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Rol</dt>
            <dd className="text-right text-zinc-900 dark:text-zinc-100">{user?.role ?? "-"}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          Estos datos provienen de <code>/auth/me</code>. El frontend no interpreta tokens.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Modulos previstos
        </h2>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {pendingModules.map((item) => (
            <li
              key={item.label}
              className="rounded border border-zinc-200 px-2 py-0.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
            >
              {item.label}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          Se habilitaran en fases posteriores del plan.
        </p>
      </section>
    </div>
  );
}
