import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { Spinner } from "@/components/Spinner";
import { useLogout, useSession } from "@/features/auth/useSession";
import { NAVIGATION } from "@/layouts/navigation";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  OPERATOR: "Operario",
};

function NavigationList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegacion principal" className="space-y-0.5">
      {NAVIGATION.map((item) =>
        item.enabled && item.to ? (
          <NavLink
            key={item.label}
            to={item.to}
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                "block rounded-md px-2.5 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-clay-50 font-medium text-clay-800 dark:bg-clay-900/30 dark:text-clay-200"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ) : (
          <span
            key={item.label}
            aria-disabled="true"
            title="Modulo previsto para una fase posterior"
            className="flex cursor-not-allowed items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-zinc-400 dark:text-zinc-600"
          >
            {item.label}
            <span className="ml-2 rounded border border-zinc-200 px-1 py-px text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
              Proximo
            </span>
          </span>
        ),
      )}
    </nav>
  );
}

/** Estructura visual de la aplicacion autenticada. */
export function AppShell() {
  const { data: user } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout.mutate(undefined, {
      // Se navega en onSettled: aunque la llamada falle, el estado en memoria
      // ya fue limpiado y no debe quedar una vista autenticada.
      onSettled: () => navigate("/login", { replace: true }),
    });
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[13rem_1fr]">
      {/* Barra superior, solo en pantallas pequenas */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 lg:hidden dark:border-zinc-800">
        <span className="text-sm font-semibold tracking-tight">Cotizador Greda</span>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="menu-principal"
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          {menuOpen ? "Cerrar" : "Menu"}
        </button>
      </div>

      <aside
        id="menu-principal"
        className={[
          "flex-col justify-between border-zinc-200 px-3 py-3 lg:flex lg:min-h-dvh lg:border-r dark:border-zinc-800",
          menuOpen ? "flex border-b" : "hidden",
        ].join(" ")}
      >
        <div>
          <div className="mb-4 hidden px-2.5 lg:block">
            <span className="text-sm font-semibold tracking-tight">Cotizador Greda</span>
          </div>
          <NavigationList onNavigate={() => setMenuOpen(false)} />
        </div>

        <div className="mt-6 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          {user ? (
            <div className="px-2.5 pb-2">
              <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {user.display_name}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                {ROLE_LABEL[user.role] ?? user.role}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {logout.isPending ? <Spinner className="size-3.5" label="Saliendo..." /> : "Cerrar sesion"}
          </button>
        </div>
      </aside>

      <main className="px-4 py-5 lg:px-8 lg:py-7">
        <Outlet />
      </main>
    </div>
  );
}
