import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import gredaLogo from "@/assets/greda-frame-1.png";
import { GredaParticleBackground } from "@/components/GredaParticleBackground";
import {
  BoxesIcon,
  CloseIcon,
  FileTextIcon,
  FlameIcon,
  FlaskIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  PackageIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  UploadIcon,
  UsersIcon,
} from "@/components/icons";
import { Spinner } from "@/components/Spinner";
import { useLogout, useSession } from "@/features/auth/useSession";
import { NAVIGATION, type NavigationIconKey, type NavigationItem } from "@/layouts/navigation";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  OPERATOR: "Operario",
};

function renderNavigationIcon(icon: NavigationIconKey, className = "size-5 shrink-0") {
  switch (icon) {
    case "home":
      return <HomeIcon className={className} />;
    case "users":
      return <UsersIcon className={className} />;
    case "upload":
      return <UploadIcon className={className} />;
    case "package":
      return <PackageIcon className={className} />;
    case "boxes":
      return <BoxesIcon className={className} />;
    case "flask":
      return <FlaskIcon className={className} />;
    case "flame":
      return <FlameIcon className={className} />;
    case "file-text":
      return <FileTextIcon className={className} />;
    case "settings":
      return <SettingsIcon className={className} />;
  }
}

interface NavigationListProps {
  items: readonly NavigationItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
}

function NavigationList({ items, collapsed = false, onNavigate }: NavigationListProps) {
  return (
    <nav aria-label="Navegación principal" className="space-y-1">
      {items.map((item) => {
        const icon = renderNavigationIcon(item.icon, "size-4.5 shrink-0");

        if (item.enabled && item.to) {
          return (
            <NavLink
              key={item.label}
              to={item.to}
              end
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
              className={({ isActive }) =>
                [
                  "group flex items-center rounded-xl text-sm font-medium transition-all duration-150",
                  collapsed ? "justify-center p-2.5" : "justify-between px-3 py-2",
                  isActive
                    ? "bg-black text-white shadow-xs hover:scale-[1.01]"
                    : "text-zinc-600 hover:bg-white hover:text-zinc-900 hover:shadow-xs",
                ].join(" ")
              }
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {icon}
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </div>
            </NavLink>
          );
        }

        return (
          <span
            key={item.label}
            aria-disabled="true"
            title={collapsed ? `${item.label} (Próximamente)` : "Módulo previsto para una fase posterior"}
            aria-label={`${item.label} (Próximamente)`}
            className={[
              "flex cursor-not-allowed items-center rounded-xl text-sm font-medium text-zinc-400 transition-colors",
              collapsed ? "justify-center p-2.5" : "justify-between px-3 py-2",
            ].join(" ")
          }
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {icon}
              {!collapsed ? <span>{item.label}</span> : null}
            </div>
            {!collapsed ? (
              <span className="ml-1 shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                Próximo
              </span>
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}

/**
 * Estructura visual de la aplicación autenticada de Cotizador GREDA.
 * Incluye Sidebar translúcida colapsable en Desktop, Drawer en Móvil y Fondo de partículas sutil.
 */
export function AppShell() {
  const { data: user } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((prev) => !prev);
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => navigate("/login", { replace: true }),
    });
  };

  // Manejo de la tecla Escape para cerrar el drawer móvil
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <div className="relative h-dvh w-full overflow-hidden flex flex-col lg:flex-row bg-transparent text-zinc-900 selection:bg-zinc-900 selection:text-white">
      {/* Fondo interactivo Canvas 2D atenuado para el Dashboard */}
      <GredaParticleBackground variant="dashboard" />

      {/* ========================================================================= */}
      {/* BARRA SUPERIOR MÓVIL (visible solo en < lg)                               */}
      {/* ========================================================================= */}
      <header className="shrink-0 z-30 flex items-center justify-between border-b border-black/[0.04] bg-white/75 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="size-9" aria-hidden="true" />
        <div className="flex items-center justify-center">
          <img
            src={gredaLogo}
            alt="Logo de Greda"
            className="size-8 select-none object-contain"
            draggable={false}
          />
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-expanded={mobileMenuOpen}
          aria-label="Abrir menú principal"
          className="flex size-9 items-center justify-center rounded-lg border border-black/[0.06] bg-white/60 text-zinc-700 shadow-2xs hover:bg-white/90 cursor-pointer"
        >
          <MenuIcon className="size-5" />
        </button>
      </header>

      {/* ========================================================================= */}
      {/* DRAWER MÓVIL (overlay + panel deslizante)                                 */}
      {/* ========================================================================= */}
      {mobileMenuOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menú principal"
          className="fixed inset-0 z-50 lg:hidden"
        >
          {/* Backdrop con blur */}
          <div
            className="fixed inset-0 bg-black/25 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Panel deslizante */}
          <div className="fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col justify-between glass-sidebar p-5 shadow-2xl transition-transform duration-200">
            <div>
              <div className="relative flex items-center justify-center pb-6 border-b border-black/[0.04]">
                <img
                  src={gredaLogo}
                  alt="Logo de Greda"
                  className="size-8 select-none object-contain"
                  draggable={false}
                />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Cerrar menú"
                  className="absolute right-0 flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-black/[0.04] hover:text-zinc-800 cursor-pointer"
                >
                  <CloseIcon className="size-5" />
                </button>
              </div>

              <div className="mt-6">
                <NavigationList
                  items={NAVIGATION}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              </div>
            </div>

            {/* Perfil en Drawer Móvil */}
            <div className="border-t border-black/[0.04] pt-4">
              {user ? (
                <div className="mb-3 px-3 py-2.5 glass-panel-inner rounded-xl">
                  <p className="truncate text-xs font-bold text-zinc-900">{user.display_name}</p>
                  <p className="truncate text-[11px] text-zinc-500">{user.email}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                    Rol: {ROLE_LABEL[user.role] ?? user.role}
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                disabled={logout.isPending}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50/70 hover:text-red-700 disabled:opacity-50 cursor-pointer"
              >
                {logout.isPending ? (
                  <Spinner className="size-4" label="Saliendo..." />
                ) : (
                  <>
                    <LogOutIcon className="size-4" />
                    <span>Cerrar sesión</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* SIDEBAR DESKTOP (fija y translúcida en pantallas grandes)                  */}
      {/* ========================================================================= */}
      <aside
        id="menu-principal"
        className={[
          "hidden lg:flex flex-col justify-between shrink-0 h-dvh glass-sidebar z-20 transition-all duration-300",
          collapsed ? "w-18 p-3" : "w-64 p-5",
        ].join(" ")}
      >
        <div className="flex flex-col min-h-0 flex-1">
          {/* Logo y Botón de Colapso */}
          <div
            className={[
              "relative flex items-center pb-6 border-b border-black/[0.04] shrink-0",
              collapsed ? "flex-col justify-center" : "justify-center",
            ].join(" ")}
          >
            <img
              src={gredaLogo}
              alt="Logo de Greda"
              className="size-8 shrink-0 select-none object-contain transition-transform duration-200 hover:scale-105"
              draggable={false}
            />

            <button
              type="button"
              onClick={toggleCollapsed}
              title={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
              aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
              className={[
                "flex size-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-black/[0.04] hover:text-zinc-700 transition-colors cursor-pointer",
                collapsed ? "mt-3" : "absolute right-0",
              ].join(" ")}
            >
              {collapsed ? (
                <PanelLeftOpenIcon className="size-4" />
              ) : (
                <PanelLeftCloseIcon className="size-4" />
              )}
            </button>
          </div>

          {/* Menú de Navegación */}
          <div className="mt-6 flex-1 overflow-y-auto no-scrollbar">
            <NavigationList items={NAVIGATION} collapsed={collapsed} />
          </div>
        </div>

        {/* Perfil de Usuario Abajo */}
        <div className="mt-auto shrink-0 border-t border-black/[0.04] pt-4">
          {user && !collapsed ? (
            <div className="mb-3 px-3 py-2.5 glass-panel-inner rounded-xl">
              <p className="truncate text-xs font-bold text-zinc-900">{user.display_name}</p>
              <p className="truncate text-[11px] text-zinc-500">{user.email}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                Rol: {ROLE_LABEL[user.role] ?? user.role}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleLogout}
            disabled={logout.isPending}
            title={collapsed ? "Cerrar sesión" : undefined}
            aria-label="Cerrar sesión"
            className={[
              "flex w-full items-center rounded-xl text-xs font-semibold text-red-600 transition-colors hover:bg-red-50/70 hover:text-red-700 disabled:opacity-50 cursor-pointer",
              collapsed ? "justify-center p-2.5" : "gap-2 px-3 py-2",
            ].join(" ")}
          >
            {logout.isPending ? (
              <Spinner className="size-4" label="Saliendo..." />
            ) : (
              <>
                <LogOutIcon className="size-4 shrink-0" />
                {!collapsed ? <span>Cerrar sesión</span> : null}
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* ÁREA DE CONTENIDO PRINCIPAL                                               */}
      {/* ========================================================================= */}
      <main className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-6 z-10 custom-scrollbar bg-transparent">
        <Outlet />
      </main>
    </div>
  );
}
