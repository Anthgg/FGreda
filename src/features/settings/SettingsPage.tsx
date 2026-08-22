import { useState } from "react";

import { ApiError } from "@/api/client";
import { Spinner } from "@/components/Spinner";
import { useSession } from "@/features/auth/useSession";
import { AuditSection } from "@/features/settings/AuditSection";
import { CommercialSection } from "@/features/settings/CommercialSection";
import { CompanySection } from "@/features/settings/CompanySection";
import { DocumentsSection } from "@/features/settings/DocumentsSection";
import { describeError } from "@/features/settings/messages";
import { SequencesSection } from "@/features/settings/SequencesSection";
import {
  useCommercialSettings,
  useCompanySettings,
  useSequences,
} from "@/features/settings/useSettings";

type TabId = "empresa" | "comercial" | "documentos" | "numeracion" | "historial";

const TABS: readonly { id: TabId; label: string; adminOnly?: boolean }[] = [
  { id: "empresa", label: "Empresa" },
  { id: "comercial", label: "Comercial" },
  { id: "documentos", label: "Documentos" },
  { id: "numeracion", label: "Numeracion" },
  { id: "historial", label: "Historial", adminOnly: true },
];

export function SettingsPage() {
  const [tab, setTab] = useState<TabId>("empresa");
  const { data: user } = useSession();

  // El rol solo decide que se muestra. Quien autoriza de verdad es el backend:
  // una peticion de escritura desde OPERATOR responde 403 aunque llegue.
  const isAdmin = user?.role === "ADMIN";

  const company = useCompanySettings();
  const commercial = useCommercialSettings();
  const sequences = useSequences();

  const loading = company.isPending || commercial.isPending || sequences.isPending;
  const failure = company.error ?? commercial.error ?? sequences.error;

  const visibleTabs = TABS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="mx-auto max-w-4xl">
      <header>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Configuracion
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Datos de empresa, parametros comerciales y numeracion de documentos.
        </p>
      </header>

      <nav
        aria-label="Secciones de configuracion"
        className="mt-5 flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800"
      >
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={[
              "-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors",
              tab === item.id
                ? "border-clay-600 font-medium text-clay-800 dark:border-clay-400 dark:text-clay-200"
                : "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {loading ? (
          <p className="text-sm text-zinc-500">
            <Spinner className="size-3.5" label="Cargando configuracion..." />
          </p>
        ) : failure ? (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            <p>{describeError(failure)}</p>
            <button
              type="button"
              onClick={() => {
                void company.refetch();
                void commercial.refetch();
                void sequences.refetch();
              }}
              className="mt-1.5 text-xs font-medium underline underline-offset-2"
            >
              Reintentar
            </button>
            {failure instanceof ApiError && failure.status === 403 ? (
              <p className="mt-1 text-xs">Su rol no tiene acceso a esta seccion.</p>
            ) : null}
          </div>
        ) : (
          <>
            {tab === "empresa" ? <CompanySection canEdit={isAdmin} /> : null}
            {tab === "comercial" ? <CommercialSection canEdit={isAdmin} /> : null}
            {tab === "documentos" ? <DocumentsSection canEdit={isAdmin} /> : null}
            {tab === "numeracion" ? <SequencesSection canEdit={isAdmin} /> : null}
            {tab === "historial" ? <AuditSection canView={isAdmin} /> : null}
          </>
        )}
      </div>
    </div>
  );
}
