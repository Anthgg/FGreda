/** Respuestas de configuracion para las pruebas. */

import type {
  AuditPage,
  CommercialSettings,
  CompanySettings,
  SequenceConfig,
} from "@/types/settings";

export const COMPANY_EMPTY: CompanySettings = {
  legal_name: null,
  trade_name: null,
  tax_id: null,
  address_line1: null,
  address_line2: null,
  district: null,
  province: null,
  department: null,
  country: null,
  postal_code: null,
  phone: null,
  mobile: null,
  email: null,
  website: null,
  contact_name: null,
  contact_role: null,
  version: 1,
  updated_at: "2026-08-22T00:00:00Z",
  logo: null,
};

export const COMPANY_FILLED: CompanySettings = {
  ...COMPANY_EMPTY,
  legal_name: "Taller Greda SAC",
  trade_name: "Greda",
  tax_id: "20123456789",
  district: "Miraflores",
  email: "contacto@greda.pe",
  version: 3,
};

export const COMMERCIAL_EMPTY: CommercialSettings = {
  currency_code: null,
  currency_symbol: null,
  tax_percent: null,
  quote_validity_days: null,
  general_conditions: null,
  payment_notes: null,
  document_footer: null,
  version: 1,
  updated_at: "2026-08-22T00:00:00Z",
  bank_accounts: [],
};

export const COMMERCIAL_FILLED: CommercialSettings = {
  ...COMMERCIAL_EMPTY,
  currency_code: "PEN",
  currency_symbol: "S/",
  tax_percent: "18",
  quote_validity_days: 15,
  version: 2,
  bank_accounts: [
    {
      id: 1,
      is_primary: true,
      bank_name: "Banco de prueba",
      account_holder: "Taller Greda SAC",
      account_number: "1234567890",
      cci: "00219300123456789015",
      notes: null,
    },
  ],
};

export const SEQUENCES: SequenceConfig[] = [
  {
    sequence_type: "QUOTE",
    prefix: "CTZ",
    pattern: "{PREFIX}-{YYYY}-{NUMBER}",
    padding: 6,
    reset_policy: "YEARLY",
    active: true,
    current_value: 0,
    period_key: "",
    preview: "CTZ-2026-000001",
    version: 1,
    updated_at: "2026-08-22T00:00:00Z",
  },
  {
    sequence_type: "FIRING",
    prefix: "HR",
    pattern: "{PREFIX}-{YYYY}-{NUMBER}",
    padding: 6,
    reset_policy: "YEARLY",
    active: true,
    current_value: 4,
    period_key: "2026",
    preview: "HR-2026-000005",
    version: 1,
    updated_at: "2026-08-22T00:00:00Z",
  },
];

export const AUDIT_PAGE: AuditPage = {
  items: [
    {
      id: 2,
      entity_type: "commercial_settings",
      entity_id: "1",
      action: "UPDATE",
      field: "tax_percent",
      old_value: null,
      new_value: "18",
      user_id: "11111111-2222-3333-4444-555555555555",
      user_display_name: "Administrador",
      created_at: "2026-08-22T01:00:00Z",
    },
    {
      id: 1,
      entity_type: "company_settings",
      entity_id: "1",
      action: "UPDATE",
      field: "legal_name",
      old_value: null,
      new_value: "Taller Greda SAC",
      user_id: "11111111-2222-3333-4444-555555555555",
      user_display_name: "Administrador",
      created_at: "2026-08-22T00:30:00Z",
    },
  ],
  total: 2,
  limit: 50,
  offset: 0,
};
