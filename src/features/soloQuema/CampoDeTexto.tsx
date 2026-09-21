import { useEffect, useRef, useState } from "react";

import { TextField } from "@/components/form";

/**
 * Texto libre que se guarda al SALIR del campo, no en cada tecla.
 *
 * La misma razón que en `DecimalField`: escribir «Taza de Ana» no son once
 * peticiones, y una edición que acaba donde empezó no gasta ninguna. Mientras
 * el campo está abierto no se sincroniza con lo guardado: un refetch a mitad de
 * la escritura borraría lo que quien cotiza está tecleando.
 */
export function CampoDeTexto({
  label,
  value,
  onCommit,
  disabled,
  hint,
  placeholder,
  requirement,
}: {
  label: string;
  value: string;
  onCommit: (valor: string) => void;
  disabled: boolean;
  hint?: string | undefined;
  placeholder?: string | undefined;
  requirement?: "required" | "optional" | undefined;
}) {
  const [borrador, setBorrador] = useState(value);
  const escribiendo = useRef(false);

  useEffect(() => {
    if (escribiendo.current) return;
    setBorrador(value);
  }, [value]);

  return (
    <TextField
      label={label}
      {...(requirement ? { requirement } : {})}
      value={borrador}
      onChange={setBorrador}
      onFocus={() => {
        escribiendo.current = true;
      }}
      onBlur={() => {
        escribiendo.current = false;
        if (borrador.trim() === value.trim()) return;
        onCommit(borrador.trim());
      }}
      disabled={disabled}
      maxLength={200}
      {...(hint ? { hint } : {})}
      {...(placeholder ? { placeholder } : {})}
    />
  );
}
