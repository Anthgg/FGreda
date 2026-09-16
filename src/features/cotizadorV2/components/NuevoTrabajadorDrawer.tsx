import { useState } from "react";
import { PrimaryButton, SecondaryButton, SelectField, TextField } from "@/components/form";
import { DecimalField } from "@/components/DecimalField";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import { useCreateV2Worker } from "@/features/cotizadorV2/useQuoterV2Labor";
import { formatMoney } from "@/utils/formatters";
import type { V2WorkerCreateInput, V2WorkerType } from "@/types/quoterV2Labor";

interface NuevoTrabajadorDrawerProps {
  onClose: () => void;
  onCreated: (workerId: number) => void;
}

export function NuevoTrabajadorDrawer({ onClose, onCreated }: NuevoTrabajadorDrawerProps) {
  const [name, setName] = useState("");
  const [workerType, setWorkerType] = useState<V2WorkerType>("INTERNAL");
  const [dailyRate, setDailyRate] = useState<string>("");
  const [workdayHours, setWorkdayHours] = useState<string>("8");
  const [validationError, setValidationError] = useState<string | null>(null);

  const createWorker = useCreateV2Worker();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) {
      setValidationError("El nombre es obligatorio.");
      return;
    }
    if (!dailyRate) {
      setValidationError("Debe indicar el jornal diario.");
      return;
    }
    if (!workdayHours) {
      setValidationError("Debe indicar las horas por jornada.");
      return;
    }

    setValidationError(null);

    const payload: V2WorkerCreateInput = {
      name: cleanName,
      worker_type: workerType,
      daily_rate: dailyRate,
      workday_hours: workdayHours,
      active: true,
    };

    createWorker.mutate(payload, {
      onSuccess: (newWorker) => {
        onCreated(newWorker.id);
        onClose();
      },
    });
  };

  const isFormIncomplete = !name.trim() || !dailyRate || !workdayHours || createWorker.isPending;

  // Calculo temporal para previsualización (asumiendo rate / hours)
  const rateNum = Number(dailyRate) || 0;
  const hoursNum = Number(workdayHours) || 1;
  const hourlyRatePreview = rateNum / hoursNum;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nuevo trabajador"
      className="fixed inset-0 z-[60] flex justify-end bg-zinc-900/40 backdrop-blur-sm transition-opacity"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
        <header className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Nuevo trabajador</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Registra los datos necesarios para calcular su mano de obra.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full border border-zinc-100 bg-white p-2 text-zinc-400 shadow-xs hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="worker-form" onSubmit={handleSubmit} className="space-y-5">
            <TextField
              label="Nombre *"
              value={name}
              onChange={(val) => {
                setName(val);
                if (validationError) setValidationError(null);
              }}
              placeholder="Ej: Juan Pérez"
            />

            <SelectField
              label="Tipo *"
              value={workerType}
              options={[
                { value: "INTERNAL", label: "Interno" },
                { value: "EXTERNAL", label: "Externo" },
              ]}
              onChange={(val) => setWorkerType(val as V2WorkerType)}
            />

            <DecimalField
              label="Jornal diario *"
              value={dailyRate}
              onCommit={(val) => setDailyRate(val ?? "")}
            />

            <DecimalField
              label="Horas por jornada *"
              value={workdayHours}
              onCommit={(val) => setWorkdayHours(val ?? "")}
            />

            {rateNum > 0 && hoursNum > 0 ? (
              <div className="mt-4 rounded-xl bg-zinc-50 p-4 border border-zinc-100">
                <span className="block text-xs font-medium text-zinc-500 mb-1">
                  Tarifa equivalente (referencia)
                </span>
                <span className="block text-sm font-semibold text-zinc-900">
                  {formatMoney(String(hourlyRatePreview))} / h
                </span>
              </div>
            ) : null}

            {validationError ? (
              <p role="alert" className="text-xs text-red-600">
                {validationError}
              </p>
            ) : null}

            {createWorker.isError ? (
              <p role="alert" className="text-xs text-red-600">
                {describeError(createWorker.error)}
              </p>
            ) : null}
          </form>
        </div>

        <footer className="p-6 border-t border-zinc-100 bg-zinc-50 flex items-center justify-end gap-3">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton type="submit" form="worker-form" disabled={isFormIncomplete}>
            {createWorker.isPending ? (
              <span className="flex items-center gap-2">
                <Spinner className="size-4 text-white" />
                <span>Creando...</span>
              </span>
            ) : (
              "Crear trabajador"
            )}
          </PrimaryButton>
        </footer>
      </div>
    </div>
  );
}
