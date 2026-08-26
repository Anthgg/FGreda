/**
 * Página de edición de una quema existente en estado borrador.
 *
 * Ruta: `/quemas/:id/editar`
 * Solo accesible para hojas con `status === "DRAFT"`.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { Badge } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import { aPayload, borradorVacio, firingADraft, type FiringDraft } from "@/features/firings/draft";
import { FiringEditor } from "@/features/firings/FiringEditor";
import { useFiring, useKilns, useUpdateFiring } from "@/features/firings/useFirings";

export function EditarQuemaPage() {
  const { id } = useParams<{ id: string }>();
  const firingId = Number(id);
  const navigate = useNavigate();

  const firingQuery = useFiring(Number.isInteger(firingId) && firingId > 0 ? firingId : null);
  const kilns = useKilns({ active: true, limit: 200 });
  const actualizar = useUpdateFiring(firingId);

  const [draft, setDraft] = useState<FiringDraft>(borradorVacio);
  const [inicializado, setInicializado] = useState(false);

  useEffect(() => {
    if (firingQuery.data && !inicializado) {
      setDraft(firingADraft(firingQuery.data));
      setInicializado(true);
    }
  }, [firingQuery.data, inicializado]);

  const sinPreview = useCallback(() => {}, []);
  const payload = aPayload(draft);

  if (!Number.isInteger(firingId) || firingId <= 0) {
    return (
      <div className="w-full py-8">
        <p role="alert" className="text-center text-sm text-red-600">
          Identificador de quema inválido.
        </p>
      </div>
    );
  }

  if (firingQuery.isPending || kilns.isPending) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-6" label="Cargando quema…" />
      </div>
    );
  }

  if (firingQuery.isError) {
    return (
      <div className="w-full py-8">
        <p role="alert" className="text-center text-sm text-red-600">
          {describeError(firingQuery.error)}
        </p>
      </div>
    );
  }

  const firing = firingQuery.data;
  if (!firing) return null;

  if (firing.status !== "DRAFT") {
    return (
      <div className="w-full py-8 space-y-4 text-center">
        <div className="rounded-3xl border border-amber-200/60 bg-amber-50/80 p-6 backdrop-blur-md">
          <h2 className="text-sm font-bold text-amber-950 uppercase tracking-wider">
            Esta quema no puede editarse
          </h2>
          <p className="mt-1 text-xs text-amber-800">
            La hoja {firing.code} se encuentra en estado {firing.status}. Solo las hojas en
            borrador permiten modificaciones.
          </p>
          <div className="mt-4">
            <Link
              to={`/quemas/${firing.id}`}
              className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
            >
              Ver detalle de la quema
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-black/[0.04] pb-5">
        <div className="space-y-1">
          <Link
            to={`/quemas/${firing.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
          >
            <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Volver al detalle
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
              Editar quema <span className="font-mono text-zinc-500">{firing.code}</span>
            </h1>
            <Badge tone="warning">Borrador</Badge>
          </div>
          <p className="text-xs text-zinc-500">
            Modifique las sesiones de horno, dimensiones o piezas de la hoja en borrador.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <SecondaryButton onClick={() => navigate(`/quemas/${firing.id}`)}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton
            type="button"
            disabled={payload === null || actualizar.isPending}
            onClick={() => {
              if (!payload) return;
              actualizar.mutate(payload, {
                onSuccess: () => navigate(`/quemas/${firing.id}`),
              });
            }}
          >
            {actualizar.isPending ? "Guardando…" : "Guardar cambios"}
          </PrimaryButton>
        </div>
      </div>

      {/* Formulario */}
      <div className="glass-card p-5 sm:p-8">
        <FiringEditor
          kilns={kilns.data?.items ?? []}
          value={draft}
          onChange={setDraft}
          onPreview={sinPreview}
        />

        {actualizar.isError ? (
          <p role="alert" className="mt-5 rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-xs text-red-700">
            {describeError(actualizar.error)}
          </p>
        ) : null}
      </div>

      {/* Barra Inferior Sticky */}
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
          <SecondaryButton onClick={() => navigate(`/quemas/${firing.id}`)}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton
            type="button"
            disabled={payload === null || actualizar.isPending}
            onClick={() => {
              if (!payload) return;
              actualizar.mutate(payload, {
                onSuccess: () => navigate(`/quemas/${firing.id}`),
              });
            }}
          >
            {actualizar.isPending ? "Guardando…" : "Guardar cambios"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
