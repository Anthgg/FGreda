/**
 * Contratos de configuracion.
 *
 * Reflejan lo que devuelve el backend. El frontend no deriva reglas de negocio
 * a partir de ellos: solo los muestra y los reenvia.
 */

import type { KilnMode } from "@/types/quotationBuilder";

export interface LogoInfo {
  content_type: string;
  size_bytes: number;
  /** Ruta del backend que sirve el binario. Nunca una URL de Storage. */
  url: string;
}

export interface CompanySettings {
  legal_name: string | null;
  trade_name: string | null;
  tax_id: string | null;

  address_line1: string | null;
  address_line2: string | null;
  ubigeo_code: string | null;
  district: string | null;
  province: string | null;
  department: string | null;
  country: string | null;
  postal_code: string | null;

  phone: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  contact_name: string | null;
  contact_role: string | null;

  version: number;
  updated_at: string;
  logo: LogoInfo | null;
}

export type CompanySettingsInput = Omit<CompanySettings, "version" | "updated_at" | "logo"> & {
  version: number;
};

export interface BankAccount {
  id: number;
  is_primary: boolean;
  bank_name: string | null;
  account_holder: string | null;
  account_number: string | null;
  cci: string | null;
  notes: string | null;
}

export type BankAccountInput = Omit<BankAccount, "id" | "is_primary">;

export interface CommercialSettings {
  currency_code: string | null;
  currency_symbol: string | null;
  /** Porcentaje, no fraccion: 18 significa 18 %. */
  tax_percent: string | number | null;
  quote_validity_days: number | null;
  /**
   * Fase 009D. Porcentaje del peso de la pieza que se estima de esmalte al
   * cotizar; misma convencion que `tax_percent` (15 = 15 %). No admite nulo:
   * la columna es NOT NULL y el Cotizador siempre necesita un porcentaje.
   *
   * El frontend NO decide su valor por omision. Si un backend anterior a
   * 009D no lo devuelve, la clave viaja como `undefined` y desaparece del
   * JSON: el backend aplica el suyo. Inventar aqui un 15 seria fijar una
   * regla de negocio en el navegador.
   */
  estimated_glaze_percent: string | number;
  /**
   * Fase 009E. Factor de PRODUCCION por defecto: multiplica el costo tecnico
   * antes de los costos fijos y del margen. NO es `default_quotation_factor`,
   * que se deriva del markup — son dos pasos distintos del costeo.
   */
  production_factor_default: string | number;
  /**
   * Fase 009K.3. Si una cotizacion NUEVA nace aplicando el factor. Arranca en
   * `false`: el factor deja de aplicarse por omision y pasa a ser una
   * decision consciente de quien cotiza.
   */
  production_factor_enabled_default: boolean;
  /** Fase 009K.3. Modo de horno con el que nace una cotizacion nueva. */
  kiln_mode_default: KilnMode;
  /** Paso del redondeo contractual. Solo 0,50 o 1,00. */
  rounding_step: string | number;

  /**
   * Fase 009K.1.1. Tarifas de casa del Cotizador de Prototipos.
   *
   * Viven en la configuracion comercial porque son politica de la casa, igual
   * que el IGV. Una CPR sin override las hereda VIVAS: si el taller sube su
   * tarifa, los borradores abiertos la ven; los documentos ya emitidos no,
   * porque al emitir se congelan.
   *
   * **Cero es legitimo**: significa que el taller todavia no la ha fijado. El
   * navegador no lo corrige ni sugiere otro numero.
   */
  prototype_design_rate: string | number;
  prototype_artist_rate: string | number;
  prototype_mold_maker_price: string | number;
  /** Tiempo, no dinero: dias que tarda el matricero por omision. */
  prototype_mold_maker_days: string | number;
  prototype_fixed_cost: string | number;

  general_conditions: string | null;
  payment_notes: string | null;
  document_footer: string | null;

  version: number;
  updated_at: string;
  bank_accounts: BankAccount[];
}

export type CommercialSettingsInput = Omit<
  CommercialSettings,
  "version" | "updated_at" | "bank_accounts"
> & {
  version: number;
  bank_account: BankAccountInput | null;
};

export type SequenceType = "QUOTE" | "FIRING";
export type ResetPolicy = "NEVER" | "YEARLY" | "MONTHLY" | "DAILY";

export interface SequenceConfig {
  sequence_type: SequenceType;
  prefix: string;
  pattern: string;
  padding: number;
  reset_policy: ResetPolicy;
  active: boolean;

  /** Ultimo numero entregado. Informativo. */
  current_value: number;
  period_key: string;
  /**
   * Como se veria el proximo correlativo. Es **solo una muestra**: el numero
   * oficial lo asigna el backend al crear un documento, y consultarlo aqui no
   * reserva ni consume nada.
   */
  preview: string;

  version: number;
  updated_at: string;
}

export interface SequenceConfigInput {
  prefix: string;
  pattern: string;
  padding: number;
  reset_policy: ResetPolicy;
  active: boolean;
  version: number;
}

export interface SequenceList {
  sequences: SequenceConfig[];
}

export interface CurrencyOption {
  code: string;
  numeric_code: string;
  name: string;
  symbol: string;
  minor_units: number | null;
}

export interface UbigeoOption {
  code: string;
  department_code: string;
  department_name: string;
  province_code: string;
  province_name: string;
  district_name: string;
}

export interface SequencePatternPreset {
  id: number;
  name: string;
  pattern: string;
  is_system: boolean;
}

export interface SequencePatternPresetInput {
  name: string;
  pattern: string;
}

export interface ReferenceData {
  currencies: CurrencyOption[];
  districts: UbigeoOption[];
  sequence_patterns: SequencePatternPreset[];
}

export interface AuditEvent {
  id: number;
  entity_type: string;
  entity_id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  user_id: string | null;
  user_display_name: string | null;
  created_at: string;
}

export interface AuditPage {
  items: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Usuarios (Fase 009K.2)
//
// Un usuario vive partido en dos: la CUENTA en Supabase Auth —de donde sale el
// correo, y donde vive la contraseña, que este frontend nunca ve— y el PERFIL
// en el backend, que dice cómo se llama, qué rol tiene y si sigue activo.
// ---------------------------------------------------------------------------
export type UserRole = "ADMIN" | "OPERATOR";

export interface AppUser {
  /** Sólo para saber a quién se edita. No se enseña en ninguna pantalla. */
  id: string;
  display_name: string;
  /** Nulo cuando el perfil existe pero Supabase no conoce la cuenta. */
  email: string | null;
  role: UserRole;
  active: boolean;
}

export interface UserPage {
  items: AppUser[];
  total: number;
}

export interface UserCreateInput {
  email: string;
  display_name: string;
  role: UserRole;
  /** Viaja de ida y nunca de vuelta: no se guarda ni se vuelve a leer. */
  password: string;
}

export interface UserUpdateInput {
  display_name?: string;
  role?: UserRole;
}
