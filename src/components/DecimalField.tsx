import { useEffect, useState } from "react";

import { TextField } from "@/components/form";
import {
  interpretarDecimal,
  interpretarEntero,
  paraEditar,
  type EstadoDecimal,
} from "@/components/decimal";

/**
 * Campo numérico del Cotizador V2. Uno solo, para las cuatro pantallas.
 *
 * Hasta 010F cada panel llevaba su propia copia de este componente —materiales,
 * mano de obra y quema tenían tres— y cada una comprobaba el número a su
 * manera. Ninguna aceptaba la coma peruana. Tres copias de una regla sobre
 * dinero son tres sitios donde la regla puede divergir sin que nadie lo note.
 *
 * ## Guarda al SALIR del campo, no al teclear
 *
 * Borrar «20» para escribir «50» pasa por la cadena vacía, y guardando al vuelo
 * el importe se pondría en cero a mitad de una pulsación. Además, una edición
 * que acaba donde empezó no gasta ni una petición ni un recálculo.
 *
 * ## Vacío es ausencia, no cero
 *
 * Un campo vacío manda `null`, que en toda la familia V2 significa «quítalo».
 * Un texto que no es un número NO manda nada: se pinta el error y el valor
 * guardado se queda como estaba. Confundir esas dos respuestas dejaría que un
 * error de tecleo borrara un precio pactado.
 *
 * Y donde el dato es OBLIGATORIO —una cantidad de piezas— el vacío tampoco es
 * `null`: es un error que se explica. `requirement="required"` no es solo una
 * etiqueta en el rótulo; cambia lo que el campo hace al quedarse vacío.
 */

interface DecimalFieldProps {
  label: string;
  /** El valor guardado, tal y como viene del backend. */
  value: string | null | undefined;
  /** Se llama al salir del campo, solo si el valor cambió y es válido. */
  onCommit: (canonico: string | null) => void;
  disabled?: boolean | undefined;
  requirement?: "required" | "optional" | undefined;
  hint?: string | undefined;
  /** Enteros —piezas, días— rechazan el separador decimal. */
  entero?: boolean | undefined;
  permitirNegativo?: boolean | undefined;
  className?: string | undefined;
}

export function DecimalField({
  label,
  value,
  onCommit,
  disabled = false,
  requirement = "optional",
  hint,
  entero = false,
  permitirNegativo = false,
  className,
}: DecimalFieldProps) {
  const guardado = paraEditar(value);
  const [borrador, setBorrador] = useState(guardado);
  const [error, setError] = useState<string | null>(null);

  // Si el valor guardado cambia por fuera —otra edición, un refetch, volver a
  // un paso— el campo lo sigue. Mientras se escribe no hay refetch en vuelo,
  // así que esto no pisa lo que el usuario está tecleando.
  useEffect(() => {
    setBorrador(guardado);
    setError(null);
  }, [guardado]);

  const confirmar = () => {
    if (borrador === guardado) {
      setError(null);
      return;
    }
    const estado: EstadoDecimal = entero
      ? interpretarEntero(borrador)
      : interpretarDecimal(borrador, { permitirNegativo });

    if (estado.tipo === "invalido") {
      setError(estado.motivo);
      return;
    }
    if (estado.tipo === "vacio") {
      if (requirement === "required") {
        // Un obligatorio vacío no se manda como `null` —eso lo retiraría— ni
        // como 0 —eso lo inventaría—. Se dice.
        setError("Indique un valor. Vacío no es cero.");
        return;
      }
      setError(null);
      onCommit(null);
      return;
    }
    setError(null);
    onCommit(estado.canonico);
  };

  return (
    <TextField
      label={label}
      requirement={requirement}
      value={borrador}
      onChange={(texto) => {
        setBorrador(texto);
        // El error se retira en cuanto se toca el campo: dejarlo puesto
        // mientras se corrige convierte la ayuda en ruido.
        if (error) setError(null);
      }}
      onBlur={confirmar}
      disabled={disabled}
      inputMode="decimal"
      {...(hint ? { hint } : {})}
      {...(error ? { error } : {})}
      {...(className ? { className } : {})}
    />
  );
}
