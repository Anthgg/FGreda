import { useState } from "react";

import { ApiError } from "@/api/client";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
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
  useReferenceData,
  useSequences,
} from "@/features/settings/useSettings";

type TabId = "empresa" | "comercial" | "documentos" | "numeracion" | "historial";

const TABS: readonly { id: TabId; label: string; adminOnly?: boolean }[] = [
  { id: "empresa", label: "Empresa" },
  { id: "comercial", label: "Comercial" },
  { id: "documentos", label: "Documentos" },
  { id: "numeracion", label: "Numeración" },
  { id: "historial", label: "Historial", adminOnly: true },
];

export function SettingsPage() {
  const [tab, setTab] = useState<TabId>("empresa");
  const { data: user } = useSession();

  // El rol solo decide qué se muestra. Quien autoriza de verdad es el backend:
  // una petición de escritura desde OPERATOR responde 403 aunque llegue.
  const isAdmin = user?.role === "ADMIN";

  const company = useCompanySettings();
  const commercial = useCommercialSettings();
  const sequences = useSequences();
  const reference = useReferenceData();

  const loading =
    company.isPending || commercial.isPending || sequences.isPending || reference.isPending;
  const failure = company.error ?? commercial.error ?? sequences.error ?? reference.error;

  const visibleTabs = TABS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="w-full space-y-6">
      {/* Encabezado Principal */}
      <header className="mb-6">
        <TypewriterTitle text="Configuración." className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900" />
        <p className="mt-1 text-xs sm:text-sm text-zinc-500">
          Datos de empresa, parámetros comerciales y numeración de documentos.
        </p>
      </header>

      {/* Tarjeta Principal Glassmorphism Fluida */}
      <div className="glass-card p-5 sm:p-8 w-full">
        {/* Navegación de Pestañas */}
        <div className="border-b border-black/[0.04] mb-8">
          <nav
            role="tablist"
            aria-label="Secciones de configuración"
            className="-mb-px flex space-x-6 sm:space-x-8 overflow-x-auto no-scrollbar sm:custom-scrollbar"
          >
            {visibleTabs.map((item) => {
              const isActive = tab === item.id;
              return (
                <button
                  key={item.id}
                  id={`tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${item.id}`}
                  onClick={() => setTab(item.id)}
                  className={[
                    "whitespace-nowrap pb-3.5 pt-1 text-xs sm:text-sm font-semibold border-b-2 transition-all duration-150 cursor-pointer",
                    isActive
                      ? "border-black text-zinc-950 font-bold"
                      : "border-transparent text-zinc-400 hover:text-zinc-700 hover:border-black/[0.08]",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Contenido de la Pestaña Activa */}
        <div>
          {loading ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              <Spinner className="size-5" label="Cargando configuración..." />
            </div>
          ) : failure ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
            >
              <p className="font-semibold">{describeError(failure)}</p>
              <button
                type="button"
                onClick={() => {
                  void company.refetch();
                  void commercial.refetch();
                  void sequences.refetch();
                  void reference.refetch();
                }}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-red-800 underline underline-offset-2 hover:text-red-900"
              >
                Reintentar carga
              </button>
              {failure instanceof ApiError && failure.status === 403 ? (
                <p className="mt-2 text-xs">Su rol no tiene acceso a esta sección.</p>
              ) : null}
            </div>
          ) : (
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
              {tab === "empresa" ? <CompanySection canEdit={isAdmin} /> : null}
              {tab === "comercial" ? <CommercialSection canEdit={isAdmin} /> : null}
              {tab === "documentos" ? <DocumentsSection canEdit={isAdmin} /> : null}
              {tab === "numeracion" ? <SequencesSection canEdit={isAdmin} /> : null}
              {tab === "historial" ? <AuditSection canView={isAdmin} /> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
