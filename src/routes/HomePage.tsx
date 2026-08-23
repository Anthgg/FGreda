import { Link } from "react-router-dom";

import {
  ArrowRightIcon,
  BoxesIcon,
  FileTextIcon,
  FlameIcon,
  FlaskIcon,
  HomeIcon,
  PackageIcon,
  SettingsIcon,
} from "@/components/icons";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { useSession } from "@/features/auth/useSession";
import { NAVIGATION, type NavigationIconKey } from "@/layouts/navigation";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  OPERATOR: "Operario",
};

function renderModuleIcon(icon: NavigationIconKey, className = "size-5 shrink-0") {
  switch (icon) {
    case "home":
      return <HomeIcon className={className} />;
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

/**
 * Pantalla de Inicio / Dashboard de Cotizador GREDA.
 *
 * Muestra el encabezado dinámico con Typewriter y la lista de Accesos Rápidos
 * a los módulos del sistema con su estado de disponibilidad real.
 */
export function HomePage() {
  const { data: user } = useSession();

  // Módulos para accesos rápidos (excluyendo "Inicio" ya que es la página actual)
  const quickAccessModules = NAVIGATION.filter((item) => item.label !== "Inicio");

  return (
    <div className="w-full space-y-6">
      {/* Encabezado con Typewriter dinámico */}
      <header className="mb-8">
        <TypewriterTitle text="Inicio." />
        <p className="mt-1 text-sm text-zinc-500">
          {user
            ? (ROLE_LABEL[user.role] ?? user.role) === user.display_name
              ? `Sesión activa como ${user.display_name}.`
              : `Sesión activa como ${ROLE_LABEL[user.role] ?? user.role} (${user.display_name}).`
            : "Sesión activa en la plataforma."}
        </p>
      </header>

      {/* Panel Principal Translúcido */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 md:p-10 transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-zinc-200/60 gap-2">
          <div>
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Accesos</h2>
            <p className="text-sm text-zinc-600 mt-0.5">
              Módulos y herramientas principales para la gestión del taller.
            </p>
          </div>
        </div>

        {/* Lista interactiva de Accesos Rápidos */}
        <div className="mt-6 divide-y divide-zinc-100">
          {quickAccessModules.map((item) => {
            const icon = renderModuleIcon(item.icon, "size-5 text-zinc-700");

            if (item.enabled && item.to) {
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between py-4 px-3 -mx-3 rounded-2xl transition-all duration-150 hover:bg-white hover:shadow-xs"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 transition-colors group-hover:bg-black group-hover:text-white shrink-0">
                      {renderModuleIcon(item.icon, "size-5")}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 group-hover:text-black">
                        {item.label}
                      </p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{item.description}</p>
                    </div>
                  </div>

                  <div className="mt-2 sm:mt-0 flex items-center gap-2 self-end sm:self-auto text-xs font-medium text-zinc-700 group-hover:text-black">
                    <span>Ingresar</span>
                    <ArrowRightIcon className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            }

            return (
              <div
                key={item.label}
                aria-disabled="true"
                className="flex flex-col sm:flex-row sm:items-center justify-between py-4 px-3 -mx-3 rounded-2xl opacity-60 cursor-not-allowed"
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 shrink-0">
                    {icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-700">{item.label}</p>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{item.description}</p>
                  </div>
                </div>

                <div className="mt-2 sm:mt-0 self-end sm:self-auto">
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Próximamente
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
