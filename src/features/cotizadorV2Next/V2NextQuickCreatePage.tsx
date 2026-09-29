import { AltaRapidaMaestros } from "@/features/cotizadorV2Next/steps/V2NextLaborStep";
import { hasQuickCreateCapability } from "@/features/auth/capabilities";
import { useSession } from "@/features/auth/useSession";
import { useV2Techniques } from "@/features/cotizadorV2/useQuoterV2Labor";

export function V2NextQuickCreatePage() {
  const session = useSession();
  const canQuickCreate = hasQuickCreateCapability(session.data);
  const techniques = useV2Techniques(true, canQuickCreate);

  if (session.isPending) {
    return <p role="status" className="py-10 text-center text-sm text-zinc-500">Verificando acceso…</p>;
  }

  if (!canQuickCreate) {
    return (
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <h1 className="font-semibold">Altas rápidas no disponibles</h1>
        <p className="mt-1">Tu perfil no tiene permiso para crear trabajadores o técnicas.</p>
      </section>
    );
  }

  if (techniques.isPending) {
    return <p role="status" className="py-10 text-center text-sm text-zinc-500">Cargando maestros…</p>;
  }

  if (techniques.isError) {
    return (
      <section role="alert" className="mx-auto w-full max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        <h1 className="font-semibold">No se pudieron cargar los maestros</h1>
        <p className="mt-1">Revisa la conexión e inténtalo de nuevo.</p>
        <button
          type="button"
          className="mt-3 font-semibold underline underline-offset-2"
          onClick={() => {
            void techniques.refetch();
          }}
        >
          Reintentar
        </button>
      </section>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">Altas rápidas de maestros</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
          Crea trabajadores y técnicas para que estén disponibles en Cotizador V2. El alta no asigna personal a una cotización ni crea usuarios de acceso.
        </p>
      </header>
      <section className="glass-card p-4 sm:p-6">
        <AltaRapidaMaestros tecnicas={techniques.data?.items ?? []} />
      </section>
    </div>
  );
}
