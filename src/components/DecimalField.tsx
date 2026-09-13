import { useEffect, useRef, useState } from "react";

import { useBorradorProtegido, useDescartes } from "@/components/borradores";
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

/**
 * Si dos textos representan la misma cifra.
 *
 * Sin pasar por `Number`: se comparan las formas canónicas, que es lo que
 * viajaría a la API. `paraEditar` ya quita los ceros de cola del lado guardado.
 */
function mismoNumero(canonico: string, guardado: string): boolean {
  if (guardado.trim() === "") return false;
  const otro = interpretarDecimal(guardado);
  if (otro.tipo !== "valido") return false;
  return normalizar(canonico) === normalizar(otro.canonico);
}

/** La forma mínima de un decimal en texto: sin ceros de cabeza ni de cola. */
function normalizar(valor: string): string {
  const negativo = valor.startsWith("-");
  const cuerpo = negativo ? valor.slice(1) : valor;
  const [entera = "", decimal = ""] = cuerpo.split(".");
  const izquierda = entera.replace(/^0+(?=\d)/, "") || "0";
  const derecha = decimal.replace(/0+$/, "");
  const texto = derecha === "" ? izquierda : `${izquierda}.${derecha}`;
  return texto === "0" ? "0" : (negativo ? "-" : "") + texto;
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
  const [escribiendo, setEscribiendo] = useState(false);
  // Lo último que se mandó. Mientras lo guardado no coincida con ello, el campo
  // sigue enseñando lo enviado. Sin esto, al salir del campo se volvía a pintar
  // el valor ANTERIOR
  // hasta que llegaba el refetch; quien volvía a entrar enseguida editaba el
  // viejo, y como mientras se escribe ya no se sincroniza, lo guardaba después.
  const [enviado, setEnviado] = useState<{ valor: string } | null>(null);

  // Si el valor guardado cambia por fuera —otra edición, un refetch, volver a
  // un paso— el campo lo sigue. Pero NO mientras alguien tiene el campo
  // abierto: desde que cambiar cualquier cosa invalida la cotización entera,
  // un refresco puede resolverse a mitad de una palabra, y borrarla sería
  // peor que enseñar un valor viejo durante los segundos que dura la edición.
  // Al salir del campo se sincroniza igualmente.
  useEffect(() => {
    // Ni mientras se escribe ni mientras hay un error en pantalla. Lo segundo
    // importa tanto como lo primero: al salir del campo con algo que no es un
    // numero, el error se pinta y el texto se conserva para poder corregirlo.
    // Sincronizar ahi borraria las dos cosas y dejaria al usuario sin saber
    // que su ultima edicion no se guardo.
    if (escribiendo || error !== null) return;
    if (enviado !== null) {
      // Alcanzado solo si lo guardado COINCIDE con lo enviado. Que simplemente
      // haya cambiado no basta: con «20» y luego «20,5» en fila, el refetch del
      // primero llegaba mientras el segundo iba en vuelo, lo guardado pasaba a
      // «20» y el campo enseñaba ese valor intermedio y viejo; quien volvía a
      // entrar editaba lo obsoleto. Si no coincide, el envío sigue en vuelo o
      // falló, y en los dos casos lo correcto es seguir enseñando lo escrito.
      const alcanzado =
        enviado.valor === "" ? guardado === "" : mismoNumero(enviado.valor, guardado);
      if (!alcanzado) return;
      setEnviado(null);
    }
    setBorrador(guardado);
  }, [guardado, escribiendo, error, enviado]);

  const confirmar = () => {
    setEscribiendo(false);
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
    // Comparado como NÚMERO y no como texto. Con «5» guardado, escribir «5,0»
    // —o «05», o «5.»— da distinto carácter a carácter y daba lugar a un
    // guardado que no cambiaba nada: una petición, un recálculo de toda la
    // cotización y una entrada de auditoría por reescribir el mismo valor.
    if (estado.tipo === "valido" && mismoNumero(estado.canonico, guardado)) {
      setError(null);
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
      setEnviado({ valor: "" });
      onCommit(null);
      return;
    }
    setError(null);
    setEnviado({ valor: estado.canonico });
    onCommit(estado.canonico);
  };

  // Si lo que se ve difiere de lo guardado, hay algo que perder. Se declara
  // aunque todavía no se haya salido del campo: teclear «2» y recargar sin
  // blur no lanza ninguna petición, y sin esto la protección de salida no lo
  // veía. Un texto que no es un número también cuenta: no está guardado.
  const estadoActual: EstadoDecimal = entero
    ? interpretarEntero(borrador)
    : interpretarDecimal(borrador, { permitirNegativo });
  // «Sucio» es lo que todavía NO ha salido. Se compara con lo ENVIADO si lo
  // hay, no solo con lo guardado: re-revisión de Codex. Tras el blur lo
  // guardado no cambia hasta el refetch, así que comparar solo con lo guardado
  // dejaba el campo «sucio» con el envío en vuelo, y si se desmontaba en ese
  // intervalo —un clic directo en otro paso— confirmaba OTRA VEZ: doble PUT,
  // doble recálculo, doble auditoría. Lo enviado ya lo vigila el estado de
  // guardado de la cotización, en vuelo o fallido.
  //
  // Y un campo deshabilitado no declara nada ni confirma nada: si la
  // cotización deja de ser editable, intentar guardar al desmontar solo
  // produciría un error artificial contra una cotización ya emitida.
  const referencia = enviado !== null ? enviado.valor : guardado;
  const sucio =
    !disabled &&
    borrador !== guardado &&
    (estadoActual.tipo === "invalido" ||
      (estadoActual.tipo === "vacio" && referencia !== "") ||
      (estadoActual.tipo === "valido" &&
        !(referencia !== "" && mismoNumero(estadoActual.canonico, referencia))));
  // Al desmontarse con cambios —atrás/adelante del navegador, cambio de ruta—
  // no hay blur: se confirma igual, como si se hubiera salido del campo.
  useBorradorProtegido(sucio, confirmar);

  // Si el usuario descarta un guardado rechazado, lo enviado sin confirmar se
  // abandona y el campo vuelve a lo guardado. No mientras escribe.
  const descartes = useDescartes();
  const descartesVistos = useRef(descartes);
  useEffect(() => {
    if (descartes === descartesVistos.current) return;
    descartesVistos.current = descartes;
    if (escribiendo || enviado === null) return;
    setEnviado(null);
    setError(null);
  }, [descartes, escribiendo, enviado]);

  return (
    <TextField
      label={label}
      requirement={requirement}
      value={borrador}
      onFocus={() => setEscribiendo(true)}
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
