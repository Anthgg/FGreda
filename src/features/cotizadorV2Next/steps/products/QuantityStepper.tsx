import { useEffect, useRef, useState } from "react";

import { useBorradorProtegido } from "@/components/borradores";

export function QuantityStepper({
  value,
  onSave,
  disabled,
}: {
  value: number;
  onSave: (val: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = draft !== String(value) && draft !== "";

  const commit = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed !== value) {
      onSave(parsed);
    } else {
      setDraft(String(value));
    }
  };

  useBorradorProtegido(isDirty, commit);

  useEffect(() => {
    if (!isDirty) setDraft(String(value));
  }, [value, isDirty]);

  const scheduleCommit = (newVal: number) => {
    setDraft(String(newVal));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSave(newVal);
    }, 600);
  };

  const handleMinus = () => {
    const current = parseInt(draft, 10) || 1;
    if (current > 1) {
      scheduleCommit(current - 1);
    }
  };

  const handlePlus = () => {
    const current = parseInt(draft, 10) || 0;
    scheduleCommit(current + 1);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Menos"
        disabled={disabled || (parseInt(draft, 10) || 1) <= 1}
        onClick={handleMinus}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        style={{ minWidth: "24px", minHeight: "24px" }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={draft}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, "");
          setDraft(val);
        }}
        onBlur={commit}
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
