/**
 * Página de detalle de una quema individual.
 *
 * Ruta: `/quemas/:id`
 */

import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Spinner } from "@/components/Spinner";
import { useSession } from "@/features/auth/useSession";
import { describeError } from "@/features/settings/messages";
import { FiringDetailPanel } from "@/features/firings/FiringDetailPanel";
import { useCancelFiring, useConfirmFiring, useFiring } from "@/features/firings/useFirings";

export function DetalleQuemaPage() {
  const { id } = useParams<{ id: string }>();
  const firingId = Number(id);

  const { data: user } = useSession();
  const isAdmin = user?.role === "ADMIN";

  const firingQuery = useFiring(Number.isInteger(firingId) && firingId > 0 ? firingId : null);
  const confirmar = useConfirmFiring();
  const anular = useCancelFiring();
  const [aviso, setAviso] = useState<string | null>(null);

  if (!Number.isInteger(firingId) || firingId <= 0) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p role="alert" className="text-center text-sm text-red-600">
          Identificador de quema inválido.
        </p>
      </div>
    );
  }

  if (firingQuery.isPending) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-6" label="Cargando quema…" />
      </div>
    );
  }

  if (firingQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-4">
        <Link
          to="/quemas"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Volver a quemas
        </Link>
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {describeError(firingQuery.error)}
        </p>
      </div>
    );
  }

  const firing = firingQuery.data;
  if (!firing) return null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8 space-y-6">
      <Link
        to="/quemas"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Volver a quemas
      </Link>

      {aviso ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {aviso}
        </p>
      ) : null}

      <div className="glass-panel rounded-2xl border border-white/60 p-5 shadow-sm sm:rounded-3xl sm:p-8">
        <FiringDetailPanel
          firing={firing}
          canEdit={isAdmin}
          isBusy={confirmar.isPending || anular.isPending}
          onConfirm={(f) => {
            setAviso(null);
            confirmar.mutate(f.id, {
              onError: (error) => setAviso(describeError(error)),
            });
          }}
          onCancel={(f) => {
            setAviso(null);
            anular.mutate(f.id, {
              onError: (error) => setAviso(describeError(error)),
            });
          }}
        />
      </div>
    </div>
  );
}
