/**
 * Modulo de quemas.
 *
 * Tres vistas: el **listado** de hojas con su detalle, los **hornos y tarifas**
 * del taller y el **simulador**. «Nueva quema» es una accion, no una vista, y
 * por eso vive en la cabecera.
 *
 * El simulador y el alta comparten el mismo editor: capturar una quema para
 * verla y capturarla para guardarla son la misma tarea, y tener dos formularios
 * distintos garantizaria que se desincronizasen.
 */

import { useState } from "react";
import { Link } from "react-router-dom";

import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { useSession } from "@/features/auth/useSession";
import { describeError } from "@/features/settings/messages";
import { borradorVacio, type FiringDraft } from "@/features/firings/draft";
import { FiringEditor } from "@/features/firings/FiringEditor";
import { FiringListTab } from "@/features/firings/FiringListTab";
import { KilnsTab } from "@/features/firings/KilnsTab";
import { useKilns } from "@/features/firings/useFirings";

type TabId = "listado" | "hornos" | "simulador";

const TABS: readonly { id: TabId; label: string }[] = [
  { id: "listado", label: "Listado" },
  { id: "hornos", label: "Hornos y tarifas" },
  { id: "simulador", label: "Simulador" },
];

/** Simulador: el editor sin nada que guardar. */
function SimuladorTab() {
  const [draft, setDraft] = useState<FiringDraft>(borradorVacio);
  const kilns = useKilns({ active: true, limit: 200 });

  if (kilns.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-5" label="Cargando hornos…" />
      </div>
    );
  }
  if (kilns.isError) {
    return (
      <p role="alert" className="py-16 text-center text-sm text-red-600">
        {describeError(kilns.error)}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Simular no guarda nada: no crea la hoja, no consume código ni mueve inventario.
      </p>
      <FiringEditor
        kilns={kilns.data?.items ?? []}
        value={draft}
        onChange={setDraft}
        showMetadata={false}
      />
    </div>
  );
}

export function FiringsPage() {
  const { data: user } = useSession();
  const isAdmin = user?.role === "ADMIN";

  const [tab, setTab] = useState<TabId>("listado");

  return (
    <div className="w-full space-y-5">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <TypewriterTitle
            text="Quemas."
            className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl"
          />
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
            Hojas de quema, ocupación de horno y reparto del costo.
          </p>
        </div>
        {isAdmin ? (
          <Link
            to="/quemas/nueva"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-xs transition-colors hover:bg-black"
          >
            Nueva quema
          </Link>
        ) : null}
      </header>

      <div className="glass-panel rounded-2xl border border-white/60 p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <div className="mb-5 border-b border-zinc-200/80">
          <nav role="tablist" aria-label="Vistas de quemas" className="-mb-px flex gap-6">
            {TABS.map((item) => {
              const activa = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-selected={activa}
                  aria-controls={`panel-${item.id}`}
                  onClick={() => setTab(item.id)}
                  className={[
                    "whitespace-nowrap border-b-2 pb-3 pt-1 text-sm font-medium transition-colors",
                    activa
                      ? "border-zinc-900 font-semibold text-zinc-900"
                      : "border-transparent text-zinc-400 hover:border-zinc-300 hover:text-zinc-700",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "listado" ? <FiringListTab canEdit={isAdmin} /> : null}
          {tab === "hornos" ? <KilnsTab canEdit={isAdmin} /> : null}
          {tab === "simulador" ? <SimuladorTab /> : null}
        </div>
      </div>
    </div>
  );
}
