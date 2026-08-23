/**
 * Borrador de una hoja de quema mientras se captura.
 *
 * Todo se guarda como texto porque es lo que teclea el usuario y lo que espera
 * el contrato. No se convierte a `number` en ningun punto del camino: la unica
 * excepcion son los identificadores y la cantidad de piezas, que son enteros.
 */

import type { FiringIn, FiringOut, FiringType, KilnOut } from "@/types/firings";

export interface SessionDraft {
  kiln_id: number;
  firing_type: FiringType;
}

export interface LineDraft {
  /** Identificador local, para que React conserve el foco al reordenar. */
  key: string;
  product_id: number | null;
  product_internal_reference?: string | null;
  description: string;
  quantity: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  low_kiln_id: number | null;
  high_kiln_id: number | null;
  factor_kiln_id: number | null;
}

export interface FiringDraft {
  firing_date: string;
  notes: string;
  sessions: SessionDraft[];
  lines: LineDraft[];
}

let contador = 0;

export function fechaHoyLocal(): string {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function nuevaLinea(): LineDraft {
  contador += 1;
  return {
    key: `linea-${contador}`,
    product_id: null,
    product_internal_reference: null,
    description: "",
    quantity: "1",
    length_cm: "",
    width_cm: "",
    height_cm: "",
    low_kiln_id: null,
    high_kiln_id: null,
    factor_kiln_id: null,
  };
}

export function borradorVacio(): FiringDraft {
  return { firing_date: fechaHoyLocal(), notes: "", sessions: [], lines: [nuevaLinea()] };
}


export function sessionKey(session: SessionDraft): string {
  return `${session.kiln_id}:${session.firing_type}`;
}

const DECIMAL_POSITIVO = /^\d+(\.\d+)?$/;
const ENTERO_POSITIVO = /^[1-9]\d*$/;

export function esEnteroPositivo(valor: string): boolean {
  return ENTERO_POSITIVO.test(valor.trim());
}

function esDecimalPositivo(valor: string): boolean {
  const limpio = valor.trim();
  return DECIMAL_POSITIVO.test(limpio) && !/^0+(\.0+)?$/.test(limpio);
}

/** Una linea esta lista cuando el servidor podria calcularla. */
export function lineaCompleta(linea: LineDraft): boolean {
  return (
    linea.description.trim() !== "" &&
    esEnteroPositivo(linea.quantity) &&
    esDecimalPositivo(linea.length_cm) &&
    esDecimalPositivo(linea.width_cm) &&
    esDecimalPositivo(linea.height_cm) &&
    (linea.low_kiln_id !== null || linea.high_kiln_id !== null)
  );
}

/**
 * Traduce el borrador al cuerpo de la API.
 *
 * Devuelve `null` mientras falte algo: pedir la vista previa con una hoja a
 * medias solo produciria un 422 en cada pulsacion de tecla.
 */
export function aPayload(draft: FiringDraft): FiringIn | null {
  if (draft.sessions.length === 0) return null;

  const listas = draft.lines.filter(lineaCompleta);
  if (listas.length === 0) return null;

  const declaradas = new Set(draft.sessions.map(sessionKey));
  const referenciaValida = listas.every(
    (linea) =>
      (linea.low_kiln_id === null || declaradas.has(`${linea.low_kiln_id}:LOW`)) &&
      (linea.high_kiln_id === null || declaradas.has(`${linea.high_kiln_id}:HIGH`)),
  );
  if (!referenciaValida) return null;

  return {
    ...(draft.firing_date ? { firing_date: draft.firing_date } : {}),
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
    sessions: draft.sessions.map((session, indice) => ({
      kiln_id: session.kiln_id,
      firing_type: session.firing_type,
      sort_order: indice,
    })),
    lines: draft.lines.flatMap((linea, indice) =>
      lineaCompleta(linea)
        ? [
            {
              ...(linea.product_id !== null ? { product_id: linea.product_id } : {}),
              description: linea.description.trim(),
              quantity: Number.parseInt(linea.quantity.trim(), 10),
              length_cm: linea.length_cm.trim(),
              width_cm: linea.width_cm.trim(),
              height_cm: linea.height_cm.trim(),
              ...(linea.low_kiln_id !== null ? { low_kiln_id: linea.low_kiln_id } : {}),
              ...(linea.high_kiln_id !== null ? { high_kiln_id: linea.high_kiln_id } : {}),
              ...(linea.factor_kiln_id !== null ? { factor_kiln_id: linea.factor_kiln_id } : {}),
              sort_order: indice,
            },
          ]
        : [],
    ),
  };
}

/** Hornos disponibles para la quema baja o la alta segun las sesiones abiertas. */
export function hornosDeSesion(
  draft: FiringDraft,
  kilns: KilnOut[],
  tipo: FiringType,
): KilnOut[] {
  const ids = new Set(
    draft.sessions.filter((s) => s.firing_type === tipo).map((s) => s.kiln_id),
  );
  return kilns.filter((kiln) => ids.has(kiln.id));
}

/** Hornos que participan en la hoja, para elegir el que decide el factor. */
export function hornosDeLaHoja(draft: FiringDraft, kilns: KilnOut[]): KilnOut[] {
  const ids = new Set(draft.sessions.map((s) => s.kiln_id));
  return kilns.filter((kiln) => ids.has(kiln.id));
}

/** Transforma una quema del backend a borrador editable. */
export function firingADraft(firing: FiringOut): FiringDraft {
  return {
    firing_date: firing.firing_date ?? "",
    notes: firing.notes ?? "",
    sessions: firing.sessions.map((s) => ({
      kiln_id: s.kiln_id,
      firing_type: s.firing_type,
    })),
    lines: firing.lines.map((l, idx) => ({
      key: `linea-edit-${l.id ?? idx}`,
      product_id: l.product_id,
      product_internal_reference: l.product_internal_reference,
      description: l.description,
      quantity: String(l.quantity),
      length_cm: l.length_cm,
      width_cm: l.width_cm,
      height_cm: l.height_cm,
      low_kiln_id: l.low_kiln_id,
      high_kiln_id: l.high_kiln_id,
      factor_kiln_id: l.factor_kiln_id,
    })),
  };
}
