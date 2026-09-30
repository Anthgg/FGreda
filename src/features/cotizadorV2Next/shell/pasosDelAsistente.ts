import { describirBloqueo } from "@/features/cotizadorV2/mensajesCicloDeVida";
import {
  PASOS,
  type DatosDelFlujo,
  type EstadoPaso,
  type PasoId,
} from "@/features/cotizadorV2/pasos";
import type { V2Blocker } from "@/types/quoterV2";

/**
 * Los siete pasos tal como los ve quien cotiza. Fase 010O.3.
 *
 * Los identificadores son los de `pasos.ts` —los mismos que viajan en la URL
 * de `/cotizador-v2`—, así que el corte de ruta no rompió un solo enlace. Desde
 * 010O.13 los títulos también son los de `pasos.ts`: una sola fuente.
 */
export const ETIQUETA_DE_PASO: Record<PasoId, { titulo: string; detalle: string }> =
  Object.fromEntries(PASOS.map(({ id, titulo, detalle }) => [id, { titulo, detalle }])) as Record<
    PasoId,
    { titulo: string; detalle: string }
  >;

/**
 * Lo que recibe cada paso. Es el contrato entre el shell y los siete archivos
 * `steps/V2Next*Step.tsx`: quien reescriba un paso cambia SU archivo y nada más.
 */
export interface PasoDelAsistenteProps {
  readonly quotationId: number;
  readonly canEdit: boolean;
  readonly datos: DatosDelFlujo;
  readonly estados: readonly EstadoPaso[];
  readonly irAPaso: (paso: PasoId) => void;
}

/**
 * Cómo se pinta un paso en la barra.
 *
 * - `falta`: algo impide emitir;
 * - `aviso`: hay algo que mirar y NO impide emitir;
 * - `listo`: nada que decir;
 * - `cargando`: todavía no se sabe. Pintar «falta» mientras llega el dato sería
 *   una alarma falsa en cada apertura.
 */
export type Situacion = "listo" | "falta" | "aviso" | "cargando";

export interface EstadoVisualDePaso {
  readonly id: PasoId;
  readonly situacion: Situacion;
  /** Cuántas cosas impiden emitir desde este paso. */
  readonly faltas: number;
  /** Avisos y recomendaciones: no impiden nada. */
  readonly avisos: number;
}

/**
 * El estado de los siete pasos, juntando las dos fuentes que hay.
 *
 * `pasos.ts` juzga con los datos que la pantalla ya tiene y responde al
 * instante, pero es una PISTA: es más laxo que el backend —da por buena una
 * pieza sin pasta si otra sí la tiene— y no conoce todos los bloqueos. Los
 * `blockers` del resumen de emisión son la AUTORIDAD: son exactamente lo que
 * impediría emitir. Un paso está en falta si cualquiera de las dos lo dice.
 *
 * Las faltas se cuentan con el máximo de las dos fuentes y no con la suma: casi
 * siempre describen lo mismo («falta el cliente» y `V2_CONFIRM_CUSTOMER_REQUIRED`)
 * y sumarlas diría «faltan 2 datos» donde falta uno.
 *
 * Un bloqueo sin paso —el IGV o el redondeo de la configuración— no se arregla
 * en ningún paso del asistente: se cuenta en «Revisar y emitir», que es donde
 * impide emitir. Ese último paso está en falta si lo está cualquier otro.
 *
 * Una cotización CONGELADA (ya no es borrador) no tiene nada que completar: se
 * emitió porque el backend la dio por buena, y marcar «falta» sobre algo que
 * no se puede editar solo confunde (010O.12).
 */
export function estadoVisualDePasos(
  estados: readonly EstadoPaso[],
  blockers: readonly V2Blocker[] | undefined,
  cargando: boolean,
  congelada = false,
): EstadoVisualDePaso[] {
  if (congelada) {
    return PASOS.map((paso) => ({ id: paso.id, situacion: "listo", faltas: 0, avisos: 0 }));
  }
  if (cargando) {
    return PASOS.map((paso) => ({ id: paso.id, situacion: "cargando", faltas: 0, avisos: 0 }));
  }

  const bloqueosPorPaso = new Map<PasoId, number>();
  for (const bloqueo of blockers ?? []) {
    const paso = describirBloqueo(bloqueo.code).paso ?? "resumen";
    bloqueosPorPaso.set(paso, (bloqueosPorPaso.get(paso) ?? 0) + 1);
  }

  const situacion = (faltas: number, avisos: number): Situacion =>
    faltas > 0 ? "falta" : avisos > 0 ? "aviso" : "listo";

  const intermedios = PASOS.filter((paso) => paso.id !== "resumen").map((paso) => {
    const estado = estados.find((uno) => uno.id === paso.id);
    const erroresLocales = estado?.senales.filter((s) => s.severidad === "error").length ?? 0;
    const avisos = estado?.senales.filter((s) => s.severidad !== "error").length ?? 0;
    const faltas = Math.max(erroresLocales, bloqueosPorPaso.get(paso.id) ?? 0);
    return { id: paso.id, situacion: situacion(faltas, avisos), faltas, avisos };
  });

  const resumen = estados.find((uno) => uno.id === "resumen");
  const faltasDelResumen =
    intermedios.reduce((total, paso) => total + paso.faltas, 0) +
    (bloqueosPorPaso.get("resumen") ?? 0);
  const avisosDelResumen = resumen?.senales.filter((s) => s.severidad !== "error").length ?? 0;

  return [
    ...intermedios,
    {
      id: "resumen",
      situacion: situacion(faltasDelResumen, avisosDelResumen),
      faltas: faltasDelResumen,
      avisos: avisosDelResumen,
    },
  ];
}

/**
 * A dónde llevar a quien abre la cotización sin decir el paso: al primero en
 * falta, o a «Revisar y emitir» si no falta nada.
 */
export function primerPasoPendiente(visual: readonly EstadoVisualDePaso[]): PasoId {
  return visual.find((paso) => paso.id !== "resumen" && paso.situacion === "falta")?.id ?? "resumen";
}
