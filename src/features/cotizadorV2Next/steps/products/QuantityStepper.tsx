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
  const groupRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<string>(String(value));
  const savedRef = useRef(value);
  const enviadoRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiarTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const guardarDraft = (texto: string) => {
    draftRef.current = texto;
    setDraft(texto);
  };

  const parsear = (texto: string) => {
    const parsed = parseInt(texto, 10);
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
  };

  const commit = () => {
    limpiarTimer();
    const parsed = parsear(draftRef.current);
    if (parsed === null) {
      guardarDraft(String(savedRef.current));
      return;
    }
    if (parsed === savedRef.current || parsed === enviadoRef.current) {
      guardarDraft(String(parsed));
      return;
    }
    enviadoRef.current = parsed;
    guardarDraft(String(parsed));
    onSave(parsed);
  };

  const draftNumerico = parsear(draft);
  const referencia = enviadoRef.current ?? savedRef.current;
  const isDirty = disabled
    ? false
    : draftNumerico === null
      ? draft !== String(savedRef.current)
      : draftNumerico !== referencia;

  useBorradorProtegido(isDirty, commit);

  useEffect(() => {
    savedRef.current = value;
    if (enviadoRef.current === value) enviadoRef.current = null;
    if (!isDirty) {
      draftRef.current = String(value);
      setDraft(String(value));
    } else {
      draftRef.current = draft;
    }
  }, [value, isDirty, draft]);

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
