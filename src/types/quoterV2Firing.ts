/**
 * Quema del Cotizador V2: horno, hornadas, gas real y tarifa.
 *
 * Dos números que nunca se mezclan, y por eso son dos campos:
 *
 * - **gas real** — lo que cuesta encender el horno. Es COSTO.
 * - **tarifa de quema** — lo que se le cobra al cliente por encender. Es
 *   PRECIO, y depende de si es externo o alumno.
 *
 * Su diferencia es la ganancia propia de la quema. Enseñarlos juntos, o
 * sumarlos en un solo total, haría imposible verla.
 *
 * Lo que el navegador manda son DECISIONES —qué horno, si hay baja, si hay
 * alta, a quién se cotiza, qué importes se pactaron—. La ocupación, las
 * hornadas y el reparto entre productos los calcula el backend: son
 * consecuencias, y aceptarlas desde aquí dejaría que la pantalla decidiera
 * cuántas veces se enciende el horno.
 */

import type { V2CustomerKind } from "@/types/quoterV2";

export interface V2KilnOption {
  kiln_id: number;
  code: string;
  name: string;
  capacity_cm3: string;
  active: boolean;
  /** Lo que ocuparía la carga actual en ESTE horno. Puede pasar de 100. */
  occupancy_percent: string;
  /** Y cuántas hornadas pediría. Es la información con la que se decide. */
  firing_count: number;
  /** Sin tarifas V2 configuradas no se puede costear, y hay que decirlo antes. */
  has_rates: boolean;
}

export interface V2FiringLine {
  line_id: number;
  product_name: string | null;
  quantity: number;
  total_volume_cm3: string;
  /** Cuánto horno ocupa esta línea. Información, NO un multiplicador. */
  occupancy_percent: string;
  /** Su participación en el volumen total: la base del reparto. */
  volume_share_percent: string;
  commercial_cost: string;
  gas_cost: string;
}

export interface V2Firing {
  production_type: string;
  customer_kind: V2CustomerKind | null;

  kiln_id: number | null;
  kiln_name: string | null;
  /** La capacidad CONGELADA: remedir el horno no cambia lo ya calculado. */
  kiln_capacity_cm3: string | null;

  total_volume_cm3: string;
  occupancy_percent: string;
  firing_count: number;
  low_fire_enabled: boolean;
  high_fire_enabled: boolean;
  low_fire_count: number;
  high_fire_count: number;
  /** Con cuánta carga va cada hornada. La última, al 60 %, cuesta igual. */
  batch_loads: string[];

  gas_cost_low: string | null;
  gas_cost_high: string | null;
  gas_low_is_override: boolean;
  gas_high_is_override: boolean;
  commercial_rate_low: string | null;
  commercial_rate_high: string | null;
  commercial_low_is_override: boolean;
  commercial_high_is_override: boolean;

  gas_total: string;
  commercial_total: string;
  /** `commercial_total - gas_total`. No es el margen de la cotización. */
  difference: string;

  /** El horno que el sistema recomendaría. RECOMIENDA: no se aplica solo. */
  recommended_kiln_id: number | null;
  kilns: V2KilnOption[];
  lines: V2FiringLine[];
  warnings: string[];
}

export interface V2FiringInput {
  kiln_id?: number | null;
  customer_kind?: V2CustomerKind;
  low_fire_enabled?: boolean;
  high_fire_enabled?: boolean;
  /** Presente y en nulo retira el acuerdo; ausente lo conserva. */
  gas_cost_low_override?: string | null;
  gas_cost_high_override?: string | null;
  commercial_rate_low_override?: string | null;
  commercial_rate_high_override?: string | null;
}

export const CUSTOMER_KIND_LABEL: Record<V2CustomerKind, string> = {
  EXTERNAL: "Cliente externo",
  STUDENT: "Alumno",
};

/** Los avisos que devuelve el backend, en lenguaje de taller. */
export const FIRING_WARNING_LABEL: Record<string, string> = {
  V2_FIRING_KILN_NOT_SELECTED:
    "Esta cotización todavía no tiene horno, así que no hay quema que calcular.",
  V2_FIRING_KILN_UNAVAILABLE:
    "El horno se dio de baja después. El costo sigue siendo el que se congeló.",
  V2_FIRING_RATES_MISSING:
    "El horno no tiene tarifas configuradas para el Cotizador V2. Se costea en cero hasta que se pongan.",
  V2_FIRING_NO_PROCESS_SELECTED:
    "No hay ninguna quema seleccionada: ni baja ni alta. No se cobra nada por quema.",
  V2_FIRING_NO_VOLUME: "Ninguna pieza tiene medidas, así que la carga del horno es cero.",
  V2_FIRING_LINE_WITHOUT_DIMENSIONS:
    "Alguna línea no tiene medidas y no ocupa horno. Revise si falta medirla.",
  V2_FIRING_OVER_CAPACITY:
    "La carga supera la capacidad del horno seleccionado. Se necesita más de una hornada.",
  V2_FIRING_RETAIL_OVER_CAPACITY:
    "Esta cotización está marcada como Por menor y supera la capacidad del horno. Decida usted: mantenerlo, cambiar de horno o pasarla a Por mayor.",
  V2_FIRING_SMALLER_KILN_FITS:
    "Esta producción cabe en un horno más chico. Puede mantener el actual o cambiarlo.",
  V2_FIRING_LARGER_KILN_SUGGESTED:
    "Se recomienda un horno más grande, o aceptar varias hornadas en el actual.",
};
