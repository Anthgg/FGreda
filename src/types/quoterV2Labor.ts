/**
 * Mano de obra del Cotizador V2: trabajadores, técnicas e ilustración.
 *
 * Tres superficies que conviene no confundir:
 *
 * - el **maestro** de trabajadores y técnicas, que es política del taller;
 * - la **tarea** de una cotización, que lleva congelado quién la hizo, a qué
 *   tarifa y con qué rendimiento, y no cambia aunque el maestro suba;
 * - la **ilustración**, que es una sola por cotización y no una técnica más.
 *
 * El navegador manda intenciones —quién, qué técnica, cuántas piezas— y recibe
 * horas y costos. Lo único que viaja de ida son los dos acuerdos explícitos:
 * la tarifa y las horas pactadas para esa cotización.
 */

export type V2WorkerType = "INTERNAL" | "EXTERNAL";

export interface V2Worker {
  id: number;
  name: string;
  worker_type: V2WorkerType;
  active: boolean;
  /** Lo que cuesta un día de esta persona. De aquí sale todo lo demás. */
  daily_rate: string;
  /** Lo que declara la ficha. `null` significa que usa la del taller. */
  workday_hours: string | null;
  /** La que se acaba usando, ya resuelta por el backend. */
  effective_workday_hours: string;
  /** `jornal / jornada`. Derivada, nunca guardada. */
  hourly_rate: string;
  notes: string | null;
  version: number;
}

export interface V2WorkerCreateInput {
  name: string;
  worker_type: V2WorkerType;
  daily_rate: string;
  workday_hours?: string | null;
  active?: boolean;
  notes?: string | null;
}

export interface V2WorkerUpdateInput {
  /** La versión leída. Sin ella dos administradores se pisan en silencio. */
  expected_version: number;
  name?: string;
  worker_type?: V2WorkerType;
  daily_rate?: string;
  workday_hours?: string | null;
  active?: boolean;
  notes?: string | null;
}

export interface V2Technique {
  id: number;
  code: string;
  name: string;
  active: boolean;
  /** Lo que rinde UNA jornada. Estándar configurado, no medición. */
  default_capacity_per_workday: string;
  unit: string;
  /** Si solo tiene sentido sobre una pieza esmaltada. */
  requires_glaze: boolean;
  /** `capacidad / jornada`. Lo calcula el backend. */
  units_per_hour: string;
  notes: string | null;
  version: number;
}

export interface V2TechniqueCreateInput {
  code: string;
  name: string;
  default_capacity_per_workday: string;
  unit?: string;
  requires_glaze?: boolean;
  active?: boolean;
  notes?: string | null;
}

export interface V2TechniqueUpdateInput {
  expected_version: number;
  code?: string;
  name?: string;
  default_capacity_per_workday?: string;
  unit?: string;
  requires_glaze?: boolean;
  active?: boolean;
  notes?: string | null;
}

export interface V2LaborLine {
  id: number;
  sort_order: number;
  v2_quotation_product_id: number | null;

  worker_id: number;
  worker_name: string;
  worker_type: V2WorkerType;
  daily_rate: string;
  workday_hours: string;
  hourly_rate: string;
  rate_overridden: boolean;

  technique_id: number;
  technique_name: string;
  technique_unit: string;
  standard_capacity: string;

  quantity: string;
  /** Lo que sale del estándar. */
  calculated_hours: string;
  /** Lo que se va a cobrar. */
  final_hours: string;
  hours_overridden: boolean;
  is_additional_personnel: boolean;
  labor_cost: string;

  warnings: string[];
}

export interface V2LaborInput {
  v2_quotation_product_id?: number | null;
  worker_id?: number | null;
  technique_id?: number | null;
  quantity?: string | null;
  /** Presente y en nulo retira el acuerdo; ausente lo conserva. */
  hourly_rate_override?: string | null;
  final_hours_override?: string | null;
  is_additional_personnel?: boolean;
}

export interface V2WorkerLoad {
  worker_id: number;
  worker_name: string;
  workday_hours: string;
  assigned_hours: string;
  /** Aviso, no bloqueo: la solución la elige una persona. */
  exceeds_workday: boolean;
  minimum_days: number;
}

export interface V2LaborPage {
  items: V2LaborLine[];
  /** Suma de la mano de obra. Sin factor: el precio es 010F. */
  labor_cost: string;
  workday_load: V2WorkerLoad[];
  /** El mínimo según las horas. NO es lo que se cobrará. */
  suggested_work_days: number;
  /** Lo que decidió quien planifica. `null`: todavía no se ha decidido. */
  effective_work_days: number | null;
}

export interface V2Illustration {
  enabled: boolean;
  quantity: string;
  notes: string | null;
  daily_rate: string | null;
  workday_hours: string | null;
  capacity_per_workday: string | null;
  hourly_rate: string | null;
  hours: string;
  cost: string;
}

export interface V2IllustrationInput {
  illustration_enabled?: boolean;
  illustration_quantity?: string;
  illustration_notes?: string | null;
  illustration_hourly_rate_override?: string | null;
}

export const WORKER_TYPE_LABEL: Record<V2WorkerType, string> = {
  INTERNAL: "Del taller",
  EXTERNAL: "Externo",
};

/** Los avisos que devuelve el backend, en lenguaje de taller. */
export const LABOR_WARNING_LABEL: Record<string, string> = {
  V2_LABOR_WORKDAY_EXCEEDED:
    "Las horas asignadas superan la jornada configurada. Decida si se hace en un día largo, en varios días o con más personal.",
  V2_LABOR_WORKER_UNAVAILABLE:
    "Esta persona ya no está activa en el maestro. El costo sigue siendo el que se congeló.",
  V2_LABOR_TECHNIQUE_UNAVAILABLE:
    "Esta técnica se retiró del catálogo. El costo sigue siendo el que se congeló.",
  V2_LABOR_GLAZE_TECHNIQUE_WITHOUT_GLAZE:
    "La técnica es de esmaltado y la pieza no lleva esmalte. Revise si falta encenderlo.",
};
