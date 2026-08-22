/** Conversion entre la respuesta del backend y el borrador editable. */

import type { CommercialSettings, CommercialSettingsInput } from "@/types/settings";

const CUENTA_VACIA = {
  bank_name: null,
  account_holder: null,
  account_number: null,
  cci: null,
  notes: null,
};

export function toCommercialInput(settings: CommercialSettings): CommercialSettingsInput {
  const { version, updated_at: _updatedAt, bank_accounts: accounts, ...rest } = settings;
  const primary = accounts.find((account) => account.is_primary) ?? accounts[0] ?? null;

  return {
    ...rest,
    version,
    bank_account: primary
      ? {
          bank_name: primary.bank_name,
          account_holder: primary.account_holder,
          account_number: primary.account_number,
          cci: primary.cci,
          notes: primary.notes,
        }
      : { ...CUENTA_VACIA },
  };
}
