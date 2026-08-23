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

import { useCallback, useState } from "react";

import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { useSession } from "@/features/auth/useSession";
import { describeError } from "@/features/settings/messages";
import { borradorVacio, aPayload, type FiringDraft } from "@/features/firings/draft";
import { FiringEditor } from "@/features/firings/FiringEditor";
import { FiringListTab } from "@/features/firings/FiringListTab";
import { KilnsTab } from "@/features/firings/KilnsTab";
import { useCreateFiring, useKilns } from "@/features/firings/useFirings";

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

/** Alta de una hoja en borrador. */
function NuevaQuema({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<FiringDraft>(borradorVacio);
  const kilns = useKilns({ active: true, limit: 200 });
  const crear = useCreateFiring();

  // `useCallback` para que el editor no dispare su efecto en cada render.
  const sinPreview = useCallback(() => {}, []);

  const payload = aPayload(draft);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nueva quema"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/30 p-4 backdrop-blur-sm"
    >
      <div className="my-8 w-full max-w-5xl rounded-3xl border border-white/60 bg-white p-5 shadow-xl sm:p-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900">Nueva quema</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ✕
          </button>
        </header>

        {kilns.isPending ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-5" label="Cargando hornos…" />
          </div>
        ) : (
          <FiringEditor
            kilns={kilns.data?.items ?? []}
            value={draft}
            onChange={setDraft}
            onPreview={sinPreview}
          />
        )}

        {crear.isError ? (
          <p role="alert" className="mt-4 text-xs text-red-600">
            {describeError(crear.error)}
          </p>
        ) : null}

        <footer className="mt-5 flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton
            type="button"
            disabled={payload === null || crear.isPending}
            onClick={() => {
              if (!payload) return;
              crear.mutate(payload, { onSuccess: onClose });
            }}
          >
            {crear.isPending ? "Guardando…" : "Guardar borrador"}
          </PrimaryButton>
        </footer>
      </div>
    </div>
  );
}

export function FiringsPage() {
  const { data: user } = useSession();
  const isAdmin = user?.role === "ADMIN";

  const [tab, setTab] = useState<TabId>("listado");
  const [creando, setCreando] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1536px] px-4 py-2 sm:px-6 lg:px-8">
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
          <PrimaryButton type="button" onClick={() => setCreando(true)}>
            Nueva quema
          </PrimaryButton>
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

      {creando && isAdmin ? <NuevaQuema onClose={() => setCreando(false)} /> : null}
    </div>
  );
}
