import { useEffect, useRef, useState } from "react";

import { useBorradorProtegido } from "@/components/borradores";

export function QuantityStepper({
  inputId,
  value,
  onSave,
  disabled,
}: {
  inputId?: string;
  value: number;
  onSave: (val: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  // Lo enviado y aún sin respuesta. Es estado, no ref: al enviar, el campo
  // tiene que volver a pintarse ya limpio aunque el texto no cambie.
  const [enviado, setEnviado] = useState<number | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<string>(String(value));
  const enviadoRef = useRef<number | null>(null);
  const valorRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiarTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const guardarDraft = (texto: string) => {
    draftRef.current = texto;
    setDraft(texto);
  };

  const guardarEnviado = (valor: number | null) => {
    enviadoRef.current = valor;
    setEnviado(valor);
  };

  const parsear = (texto: string) => {
    const parsed = parseInt(texto, 10);
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
  };

  const commit = () => {
    limpiarTimer();
    const parsed = parsear(draftRef.current);
    if (parsed === null) {
      guardarDraft(String(enviadoRef.current ?? valorRef.current));
      return;
    }
    guardarDraft(String(parsed));
    if (parsed === (enviadoRef.current ?? valorRef.current)) return;
    guardarEnviado(parsed);
    onSave(parsed);
  };

  const draftNumerico = parsear(draft);
  const referencia = enviado ?? value;
  const isDirty = disabled
    ? false
    : draftNumerico === null
      ? draft !== String(referencia)
      : draftNumerico !== referencia;

  useBorradorProtegido(isDirty, commit);

  // Llega un valor del servidor. Si el campo seguía lo último enviado (o lo
  // guardado), lo adopta: es la respuesta, sea la pedida u otra. Si la persona
  // ya escribió algo distinto, se respeta su borrador.
  useEffect(() => {
    const anterior = enviadoRef.current ?? valorRef.current;
    valorRef.current = value;
    if (parsear(draftRef.current) === anterior) {
      guardarDraft(String(value));
      guardarEnviado(null);
    } else if (enviadoRef.current === value) {
      guardarEnviado(null);
    }
  }, [value]);

  useEffect(() => {
    return () => limpiarTimer();
  }, []);

  const scheduleCommit = () => {
    limpiarTimer();
    timerRef.current = setTimeout(commit, 600);
  };

  const handleMinus = () => {
    const current = parsear(draftRef.current) ?? 1;
    if (current > 1) {
      guardarDraft(String(current - 1));
      scheduleCommit();
    }
  };

  const handlePlus = () => {
    const current = parsear(draftRef.current) ?? 0;
    guardarDraft(String(current + 1));
    scheduleCommit();
  };

  const handleGroupBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const siguiente = event.relatedTarget;
    if (siguiente instanceof Node && groupRef.current?.contains(siguiente)) return;
    commit();
  };

  return (
    <div ref={groupRef} className="flex items-center gap-2" onBlur={handleGroupBlur}>
      <button
        type="button"
        aria-label="Menos"
        disabled={disabled || (draftNumerico ?? 1) <= 1}
        onClick={handleMinus}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        style={{ minWidth: "24px", minHeight: "24px" }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={draft}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, "");
          guardarDraft(val);
          scheduleCommit();
        }}
        className="h-8 w-16 rounded-lg border border-black/10 bg-white text-center text-sm tabular-nums"
        aria-label="Cantidad"
      />
      <button
        type="button"
        aria-label="Más"
        disabled={disabled}
        onClick={handlePlus}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        style={{ minWidth: "24px", minHeight: "24px" }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
    </div>
  );
}
