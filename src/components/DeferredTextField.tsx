import { useEffect, useRef, useState } from "react";

import {
  seguirEnvio,
  useBorradorProtegido,
  useUltimoDescarte,
  type ResultadoDeGuardado,
} from "@/components/borradores";
import { TextAreaField, TextField } from "@/components/form";

export interface DeferredTextFieldProps {
  label: string;
  /** El valor persistido. `null` y `undefined` se muestran vacíos. */
  value: string | null | undefined;
  /** Se llama al salir del campo, nunca al teclear. */
  onCommit: (value: string) => void | Promise<ResultadoDeGuardado>;
  disabled?: boolean;
  requirement?: "required" | "optional";
  hint?: string;
  error?: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  multiline?: boolean;
  rows?: number;
  /** Algunas líneas normalizan espacios al guardar; las notas conservan el texto escrito. */
  trimOnCommit?: boolean;
}

function mismoTexto(primero: string, segundo: string): boolean {
  return primero.trim() === segundo.trim();
}

/** Texto compartido del Cotizador V2: edición local, guardado al salir. */
export function DeferredTextField({
  label,
  value,
  onCommit,
  disabled = false,
  requirement = "optional",
  hint,
  error,
  placeholder,
  maxLength,
  className,
  multiline = false,
  rows = 3,
  trimOnCommit = false,
}: DeferredTextFieldProps) {
  const guardado = value ?? "";
  const [borrador, setBorrador] = useState(guardado);
  const [escribiendo, setEscribiendo] = useState(false);
  const [enviado, setEnviado] = useState<{ valor: string } | null>(null);

  // No pisa texto mientras se edita ni mientras un guardado anterior sigue
  // pendiente. Solo un refetch que alcance el texto enviado desbloquea el campo.
  useEffect(() => {
    if (escribiendo) return;
    if (enviado !== null) {
      if (!mismoTexto(guardado, enviado.valor)) return;
      setEnviado(null);
    }
    setBorrador(guardado);
  }, [guardado, escribiendo, enviado]);

  const envios = useRef(0);
  const [firmaFallida, setFirmaFallida] = useState<string | null>(null);

  const seguir = (resultado: unknown) => {
    const secuencia = ++envios.current;
    seguirEnvio(
      resultado,
      () => envios.current === secuencia,
      (final) => {
        if (final.ok) {
          setFirmaFallida(null);
          if (final.fresco !== false) setEnviado(null);
        } else {
          setFirmaFallida(final.firma);
        }
      },
    );
  };

  const confirmar = () => {
    setEscribiendo(false);
    if (disabled || mismoTexto(borrador, guardado)) return;

    const valor = trimOnCommit ? borrador.trim() : borrador;
    setEnviado({ valor });
    seguir(onCommit(valor));
  };

  const sucio =
    !disabled &&
    !mismoTexto(borrador, guardado) &&
    (enviado === null || !mismoTexto(borrador, enviado.valor));
  useBorradorProtegido(sucio, confirmar);

  const descarte = useUltimoDescarte();
  const descarteVisto = useRef(descarte.n);
  useEffect(() => {
    if (descarte.n === descarteVisto.current) return;
    descarteVisto.current = descarte.n;
    if (escribiendo || firmaFallida === null || firmaFallida !== descarte.firma) return;
    setFirmaFallida(null);
    setEnviado(null);
  }, [descarte, escribiendo, firmaFallida]);

  const setBorradorSeguro = (texto: string) => {
    setBorrador(texto);
    setFirmaFallida(null);
  };

  if (multiline) {
    return (
      <div onFocus={() => setEscribiendo(true)} onBlur={confirmar}>
        <TextAreaField
          label={label}
          requirement={requirement}
          value={borrador}
          onChange={setBorradorSeguro}
          disabled={disabled}
          rows={rows}
          placeholder={placeholder}
          hint={hint}
          error={error}
          className={className}
        />
      </div>
    );
  }

  return (
    <TextField
      label={label}
      requirement={requirement}
      value={borrador}
      onChange={setBorradorSeguro}
      onFocus={() => setEscribiendo(true)}
      onBlur={confirmar}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={maxLength}
      hint={hint}
      error={error}
      className={className}
    />
  );
}
