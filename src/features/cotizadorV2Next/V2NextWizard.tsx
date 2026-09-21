import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useV2Quotation } from "@/features/cotizadorV2/useQuoterV2";
import { useEstadoDeGuardado } from "@/features/cotizadorV2/useEstadoDeGuardado";
import { Spinner } from "@/components/Spinner";
import { ApiError } from "@/api/client";
import { V2NextClientStep } from "./steps/V2NextClientStep";
import { V2NextProductsStep } from "./steps/V2NextProductsStep";
import { V2_EFFECTIVE_STATUS_LABEL } from "@/types/quoterV2";

const STEPS = ["Cliente", "Productos", "Materiales", "Procesos", "Quema", "Precio", "Resumen"];

export function V2NextWizard({ quotationId }: { quotationId: number }) {
  const { step } = useParams();
  const navigate = useNavigate();
  const currentStep = step ? parseInt(step, 10) - 1 : 0;
  
  const query = useV2Quotation(quotationId);
  const guardado = useEstadoDeGuardado(quotationId);
  const [pendingStep, setPendingStep] = useState<number | null>(null);

  useEffect(() => {
    if (pendingStep !== null && !guardado.hayRiesgo) {
      navigate(`/cotizador-v2-next/${quotationId}/${pendingStep + 1}`);
      setPendingStep(null);
    }
  }, [guardado.hayRiesgo, pendingStep, quotationId, navigate]);

  if (query.isPending) {
    return <div className="p-12"><Spinner className="mx-auto size-6" /></div>;
  }
  if (query.isError) {
    return <div className="p-12 text-red-600">{query.error instanceof ApiError && query.error.status === 404 ? "No encontrado" : "Error al cargar"}</div>;
  }

  const q = query.data;

  const handleStep = (idx: number) => {
    if (guardado.hayRiesgo) {
      setPendingStep(idx);
    } else {
      navigate(`/cotizador-v2-next/${quotationId}/${idx + 1}`);
    }
  };

  const handleBack = () => {
    navigate("/cotizador-v2-next");
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-none px-4 pt-2 pb-3">
        <div className="max-w-[1600px] mx-auto">
          <button onClick={handleBack} className="text-[11px] font-bold text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer bg-transparent border-0 p-0 mb-3">
            ← Cotizaciones
          </button>
          
          <div className="flex items-end justify-between gap-5 mt-1">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
                <span>Cotización</span>
                <span className="inline-flex px-2 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 text-[9px] font-extrabold">
                  {V2_EFFECTIVE_STATUS_LABEL[q.effective_status] || q.effective_status}
                </span>
              </div>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900 leading-tight">
                {q.name || "Nueva cotización"}
              </h1>
              <div className="mt-1 text-[11px] text-zinc-500">{q.code}</div>
            </div>
            <div className="hidden sm:block text-right text-[10px] text-zinc-500">
              Último guardado<br/><b className="text-zinc-800 text-[10px]">ahora</b>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-none px-4 pb-3 overflow-hidden">
        <div className="max-w-[1600px] mx-auto flex gap-1 p-1.5 bg-white/55 backdrop-blur-xl border border-black/5 rounded-2xl overflow-x-auto custom-scrollbar">
          {STEPS.map((s, i) => {
            const isCurrent = i === currentStep;
            const isDone = i < currentStep;
            return (
              <button
                key={i}
                onClick={() => handleStep(i)}
                className={`flex items-center gap-2 px-2 py-2 rounded-xl min-w-[118px] transition-colors cursor-pointer border-0 ${
                  isCurrent ? 'bg-zinc-900 text-white' : 
                  isDone ? 'bg-transparent text-zinc-700 hover:bg-black/5' : 
                  'bg-transparent text-zinc-400 hover:bg-black/5'
                }`}
              >
                <span className={`w-5 h-5 flex-none rounded-full border flex items-center justify-center text-[9px] font-extrabold ${
                  isCurrent ? 'border-white/20 bg-white/10' :
                  isDone ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                  'border-zinc-300'
                }`}>
                  {isDone ? '✓' : String(i + 1)}
                </span>
                <span className="text-[10px] font-extrabold truncate">{s}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-4 pt-1 pb-32">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-5 items-start">
          
          <div className="bg-white/55 backdrop-blur-xl border border-black/5 rounded-[18px] shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <h2 className="text-[17px] font-bold text-zinc-900 tracking-tight m-0">{STEPS[currentStep]}</h2>
              <div className="px-2 py-1 rounded-full bg-zinc-100 border border-black/5 text-zinc-500 text-[9px] font-extrabold">
                Paso {currentStep + 1} de 7
              </div>
            </div>

            {currentStep === 0 && <V2NextClientStep quotation={q} />}
            {currentStep === 1 && <V2NextProductsStep quotation={q} />}
            {currentStep > 1 && (
              <div className="border border-dashed border-zinc-300 rounded-[15px] p-10 text-center text-[11px] text-zinc-400 bg-white/35">
                Esta fase solo muestra la estructura general del paso a paso.
              </div>
            )}
          </div>

          <aside className="hidden lg:block bg-white/45 backdrop-blur-md border border-black/5 rounded-[18px] p-5 sticky top-0">
            <h3 className="text-[11px] font-bold text-zinc-900 mb-3 m-0">Cotización</h3>
            <div className="flex justify-between py-2.5 text-[10px]">
              <span className="text-zinc-500">Código</span>
              <b className="text-zinc-800 text-right">{q.code}</b>
            </div>
            <div className="flex justify-between py-2.5 text-[10px] border-t border-black/5">
              <span className="text-zinc-500">Estado</span>
              <b className="text-zinc-800 text-right">{V2_EFFECTIVE_STATUS_LABEL[q.effective_status] || q.effective_status}</b>
            </div>
            <div className="flex justify-between py-2.5 text-[10px] border-t border-black/5">
              <span className="text-zinc-500">Cliente</span>
              <b className="text-zinc-800 text-right truncate max-w-[140px]">{q.customer_name || "Pendiente"}</b>
            </div>
            <div className="flex justify-between py-2.5 text-[10px] border-t border-black/5">
              <span className="text-zinc-500">Paso</span>
              <b className="text-zinc-800 text-right">{currentStep + 1} / 7</b>
            </div>
          </aside>

        </div>
      </div>

      <div className="fixed z-20 bottom-0 left-0 lg:left-[244px] right-0 p-3 pointer-events-none">
        <div className="max-w-[1600px] mx-auto border border-black/10 rounded-[15px] bg-white/85 backdrop-blur-xl shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-2.5 pointer-events-auto">
          <div className={`flex items-center justify-center sm:justify-start gap-2 text-[10px] font-bold ${
            guardado.fallidos.length > 0 ? "text-red-700" :
            guardado.enVuelo > 0 ? "text-amber-600" :
            guardado.borradores > 0 ? "text-amber-600" :
            "text-zinc-600"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              guardado.fallidos.length > 0 ? "bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.1)]" :
              guardado.enVuelo > 0 ? "bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.1)] animate-pulse" :
              guardado.borradores > 0 ? "bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.1)]" :
              "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.1)]"
            }`}></span>
            {guardado.fallidos.length > 0
              ? "Hay cambios que no se guardaron"
              : guardado.enVuelo > 0
                ? "Guardando cambios..."
                : guardado.borradores > 0
                  ? "Hay cambios sin guardar"
                  : "Todos los cambios guardados"}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button 
              disabled={guardado.enVuelo > 0}
              className="h-9 px-3 rounded-xl border border-zinc-200 bg-white/80 text-zinc-800 text-[10px] font-extrabold hover:bg-zinc-50 transition-colors cursor-pointer w-full sm:w-auto disabled:opacity-50"
            >
              Guardar borrador
            </button>
            <button
              onClick={() => { if(currentStep < 6) handleStep(currentStep + 1); }} 
              disabled={guardado.fallidos.length > 0 || pendingStep !== null}
              className="h-9 px-3 rounded-xl bg-zinc-900 text-white text-[10px] font-extrabold hover:bg-zinc-800 transition-colors cursor-pointer w-full sm:w-auto disabled:opacity-50"
            >
              {pendingStep !== null ? "Guardando..." : currentStep === 6 ? "Finalizar revisión V" : "Continuar  "}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
