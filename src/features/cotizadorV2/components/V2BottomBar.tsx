import { useEffect } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/form";
import { type PasoId } from "@/features/cotizadorV2/pasos";
import { forzarGuardadoDeBorradores } from "@/components/borradores";

interface V2BottomBarProps {
  anterior?: { id: PasoId; titulo: string } | undefined;
  siguiente?: { id: PasoId; titulo: string } | undefined;
  onAnterior?: () => void;
  onSiguiente?: () => void;
  guardadoFallidos: number;
  guardadoEnVuelo: number;
  guardadoBorradores: number;
}

export function V2BottomBar({
  anterior,
  siguiente,
  onAnterior,
  onSiguiente,
  guardadoFallidos,
  guardadoEnVuelo,
  guardadoBorradores,
}: V2BottomBarProps) {
  
  const estadoTexto = 
    guardadoFallidos > 0 ? "Hay cambios que no se guardaron." :
    guardadoEnVuelo > 0 ? "Guardando..." :
    guardadoBorradores > 0 ? "Hay cambios sin guardar" :
    "Todos los cambios guardados";
  
  const estadoClase = 
    guardadoFallidos > 0 ? "text-red-700 font-semibold" :
    guardadoEnVuelo > 0 ? "text-amber-700 font-medium" :
    guardadoBorradores > 0 ? "text-zinc-600" :
    "text-emerald-700 font-medium";

  return (
    <div className="sticky bottom-0 left-0 right-0 z-40 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 bg-white/95 backdrop-blur px-4 py-4 mt-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sm:px-6 rounded-t-2xl">
      <div className="flex-1 min-w-[120px]">
        {anterior ? (
          <SecondaryButton type="button" onClick={onAnterior}>
            &larr; {anterior.titulo}
          </SecondaryButton>
        ) : null}
      </div>

      <div className="flex flex-col items-center flex-1 min-w-[200px]">
        <p data-testid="estado-guardado" className={`text-xs ${estadoClase}`} aria-live="polite">
          {estadoTexto}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-1 justify-end min-w-[250px]">
        {guardadoBorradores > 0 && (
          <button
            type="button"
            onClick={() => forzarGuardadoDeBorradores()}
            disabled={guardadoEnVuelo > 0}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50 cursor-pointer transition-colors"
          >
            {guardadoEnVuelo > 0 ? "Guardando..." : "Guardar borrador"}
          </button>
        )}
        
        {siguiente ? (
          <PrimaryButton type="button" onClick={onSiguiente}>
            {siguiente.titulo} &rarr;
          </PrimaryButton>
        ) : null}
      </div>
    </div>
  );
}
