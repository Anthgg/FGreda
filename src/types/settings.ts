/**
 * Contratos de configuracion.
 *
 * Reflejan lo que devuelve el backend. El frontend no deriva reglas de negocio
 * a partir de ellos: solo los muestra y los reenvia.
 */

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
