/**
 * Página de alta de una nueva quema en borrador.
 *
 * Ruta: `/quemas/nueva`
 * Vive como página de primer nivel dentro de `AppShell`.
 */

import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { Badge } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import { aPayload, borradorVacio, type FiringDraft } from "@/features/firings/draft";
import { FiringEditor } from "@/features/firings/FiringEditor";
import { useCreateFiring, useKilns } from "@/features/firings/useFirings";

export function NuevaQuemaPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<FiringDraft>(borradorVacio);
  const kilns = useKilns({ active: true, limit: 200 });
  const crear = useCreateFiring();

  const sinPreview = useCallback(() => {}, []);
  const payload = aPayload(draft);

  return (
    <div className="w-full space-y-6">
      {/* Cabecera de Página */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-black/[0.04] pb-5">
        <div className="space-y-1">
          <Link
            to="/quemas"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
          >
            <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Volver a quemas
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
              Nueva quema
            </h1>
            <Badge tone="warning">Borrador</Badge>
          </div>
          <p className="text-xs text-zinc-500">
            Configure sesiones de horno, distribuya las piezas a quemar y estime el costo del lote.
          </p>
        </div>

        {/* Acciones Rápidas Superior (Desktop) */}
        <div className="hidden sm:flex items-center gap-2">
          <SecondaryButton onClick={() => navigate("/quemas")}>Cancelar</SecondaryButton>
          <PrimaryButton
            type="button"
            disabled={payload === null || crear.isPending}
            onClick={() => {
              if (!payload) return;
              crear.mutate(payload, {
                onSuccess: (res) => navigate(`/quemas/${res.id}`),
              });
            }}
          >
            {crear.isPending ? "Guardando…" : "Guardar borrador"}
          </PrimaryButton>
        </div>
      </div>

      {/* Cuerpo del Formulario */}
      <div className="glass-card p-5 sm:p-8">
        {kilns.isPending ? (
          <div className="flex justify-center py-20">
            <Spinner className="size-6" label="Cargando hornos…" />
          </div>
        ) : kilns.isError ? (
          <p role="alert" className="py-12 text-center text-xs text-red-600">
            {describeError(kilns.error)}
          </p>
        ) : (
          <FiringEditor
            kilns={kilns.data?.items ?? []}
            value={draft}
            onChange={setDraft}
            onPreview={sinPreview}
          />
        )}

        {crear.isError ? (
          <p role="alert" className="mt-5 rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-xs text-red-700">
            {describeError(crear.error)}
          </p>
        ) : null}
      </div>

      {/* Barra de Acciones Inferior / Sticky */}
      <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/60 bg-white/80 p-4 shadow-xl backdrop-blur-md">
        {payload === null ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Faltan campos obligatorios para guardar</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            <svg className="size-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Listo para guardar</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <SecondaryButton onClick={() => navigate("/quemas")}>Cancelar</SecondaryButton>
          <PrimaryButton
            type="button"
            disabled={payload === null || crear.isPending}
            onClick={() => {
              if (!payload) return;
              crear.mutate(payload, {
                onSuccess: (res) => navigate(`/quemas/${res.id}`),
              });
            }}
          >
            {crear.isPending ? "Guardando…" : "Guardar borrador"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
