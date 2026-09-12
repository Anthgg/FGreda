/**
 * Normalización de números escritos a mano. Una sola, para todo el Cotizador V2.
 *
 * Existe porque en Perú se escribe «2,5» tanto como «2.5», y hasta 010F cada
 * pantalla de V2 se defendía por su cuenta: materiales, mano de obra, quema y
 * precio tenían cada una su comprobación, ninguna aceptaba la coma, y las
 * cuatro convertían de forma ligeramente distinta. Eso son cuatro sitios donde
 * un importe puede acabar valiendo otra cosa.
 *
 * ## Las tres reglas
 *
 * 1. **la coma y el punto son el mismo separador decimal.** «2,5» y «2.5» son
 *    el número 2,5. Rechazar la coma no protege de nada: quien la escribe ve un
 *    error donde acaba de teclear algo correcto;
 * 2. **el campo vacío NO es cero.** Es un campo a medio escribir. Borrar «20»
 *    para teclear «50» pasa por la cadena vacía, y convertirla en 0 pondría la
 *    cotización a cero a mitad de una pulsación. Vacío es *ausencia*, y quien
 *    llama decide qué significa;
 * 3. **al backend va siempre el formato canónico.** La coma se queda en la
 *    pantalla; por la API viaja un punto. Mandar «2,5» dejaría que el servidor
 *    tuviera que adivinar, y el día que adivine mal lo hará sobre un precio.
 *
 * ## Lo que NO hace
 *
 * **No redondea, no escala y no calcula.** Devuelve el texto normalizado, no un
 * `number`: el motor económico vive en el backend y trabaja con `Decimal`.
 * Pasar por `Number` aquí introduciría coma flotante en el único sitio del
 * proyecto que la tiene prohibida —`0.1 + 0.2`— y el importe que la pantalla
 * enseñara dejaría de ser el que el servidor guardó.
 */

/** Lo que significa un texto escrito en un campo numérico. */
export type EstadoDecimal =
  /** El campo está vacío: ausencia, no cero. */
  | { readonly tipo: "vacio" }
  /** Un número válido, ya en formato canónico y listo para la API. */
  | { readonly tipo: "valido"; readonly canonico: string }
  /** Algo que no es un número. Lleva el motivo, para poder decirlo. */
  | { readonly tipo: "invalido"; readonly motivo: string };

/** Solo dígitos, un separador decimal y un signo opcional al principio. */
const NUMERO = /^-?\d*(?:[.,]\d*)?$/;

/**
 * Interpreta lo que hay escrito en un campo numérico.
 *
 * `permitirNegativo` está en `false` por defecto porque en este dominio casi
 * nada puede serlo: un peso, una tarifa o una cantidad negativa no son un
 * descuento, son un error de captura.
 */
export function interpretarDecimal(
  texto: string,
  opciones: { permitirNegativo?: boolean } = {},
): EstadoDecimal {
  const limpio = texto.trim();
  if (limpio === "") return { tipo: "vacio" };

  if (!NUMERO.test(limpio)) {
    return { tipo: "invalido", motivo: "Escriba un número. Puede usar coma o punto." };
  }

  // La coma peruana y el punto son el mismo separador. Y un separador SIN
  // decimales detras se cae: «2,» es lo que hay en pantalla justo antes de
  // teclear el decimal, pero «2.» no es una forma canonica y no puede salir
  // hacia la API. Se acepta lo que se escribio y se manda el numero que es.
  const canonico = limpio.replace(",", ".").replace(/\.$/, "");
  // «-», «.» o «,» pasan la expresión regular y no son números: son un número a
  // medio escribir, y por eso se tratan como inválidos y no como vacío.
  if (canonico === "" || canonico === "-" || canonico === "." || canonico === "-.") {
    return { tipo: "invalido", motivo: "Escriba un número. Puede usar coma o punto." };
  }

  if (!opciones.permitirNegativo && canonico.startsWith("-")) {
    return { tipo: "invalido", motivo: "No puede ser negativo." };
  }
  return { tipo: "valido", canonico };
}

/**
 * El texto canónico de un campo, o `null` si está vacío.
 *
 * Es el atajo para el caso habitual: mandar a la API lo que se escribió, con
 * `null` cuando no se escribió nada. Un texto inválido devuelve `undefined`,
 * que es la tercera respuesta y significa «no mandes nada»: distinguirla de
 * `null` es lo que impide que un error de tecleo borre un valor guardado.
 */
export function decimalCanonico(
  texto: string,
  opciones: { permitirNegativo?: boolean } = {},
): string | null | undefined {
  const estado = interpretarDecimal(texto, opciones);
  if (estado.tipo === "vacio") return null;
  if (estado.tipo === "invalido") return undefined;
  return estado.canonico;
}

/**
 * Lo mismo para un entero: piezas, días, unidades.
 *
 * Un separador decimal aquí es un error, no un redondeo. «10,5 piezas» no
 * existe, y aceptarlo truncando dejaría al usuario con media pieza menos sin
 * que nada se lo dijera.
 */
export function interpretarEntero(texto: string): EstadoDecimal {
  const limpio = texto.trim();
  if (limpio === "") return { tipo: "vacio" };
  if (!/^\d+$/.test(limpio)) {
    return { tipo: "invalido", motivo: "Escriba un número entero, sin decimales." };
  }
  // Los ceros de cabeza se quitan con texto, no con `Number`: convertir aqui
  // seria meter coma flotante en el unico fichero del proyecto que la tiene
  // prohibida, y «0007» no necesita aritmetica para ser 7.
  return { tipo: "valido", canonico: limpio.replace(/^0+(?=\d)/, "") };
}

/**
 * Cómo se ENSEÑA un número que vino del backend.
 *
 * El backend manda `500.000000` porque su columna tiene seis decimales; en un
 * campo editable eso es ruido que hay que borrar antes de escribir. Se quitan
 * los ceros de cola sin tocar el valor: `500.000000` se ve como `500` y
 * `0.001300` como `0.0013`.
 *
 * Se hace con texto, no con `Number`: `Number("0.001300").toString()` funciona
 * hoy y deja de funcionar con dieciocho decimales.
 */
export function paraEditar(valor: string | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  if (!valor.includes(".")) return valor;
  const recortado = valor.replace(/0+$/, "").replace(/\.$/, "");
  return recortado === "" || recortado === "-" ? "0" : recortado;
}
