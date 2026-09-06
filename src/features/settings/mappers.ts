/** Conversion entre la respuesta del backend y el borrador editable. */

import type {
  CommercialSettings,
  CommercialSettingsInput,
} from "@/types/settings";

const CUENTA_VACIA = {
  bank_name: null,
  account_holder: null,
  account_number: null,
  cci: null,
  notes: null,
};

/**
 * Campos que el backend guarda como `Numeric` y el formulario edita a mano.
 *
 * Se enumeran en vez de recorrer todo el objeto: recortar ceros de un texto
 * libre —el pie de documento, unas condiciones— podria cambiar lo que alguien
 * escribio.
 */
const NUMERICOS = [
  "tax_percent",
  "estimated_glaze_percent",
  "production_factor_default",
  "prototype_design_rate",
  "prototype_artist_rate",
  "prototype_mold_maker_price",
  "prototype_mold_maker_days",
  "prototype_fixed_cost",
] as const;

/**
 * Un numero sin la escala de su columna.
 *
 * El backend guarda `Numeric(24, 12)` y devuelve «200.000000000000». Eso es la
 * precision del almacenamiento, no lo que alguien tecleo: en pantalla son 200.
 * Se recortan los ceros sobrantes y se conserva la parte decimal que si dice
 * algo, porque media jornada de matricero es media jornada.
 *
 * No es aritmetica: no suma, no redondea, no cambia el valor que viaja de
 * vuelta. Solo deja de escribir ceros que nadie puso.
 *
 * `rounding_step` queda fuera a proposito: es un selector cuyo valor se compara
 * como numero, no un campo que se lea.
 */
function sinEscala(value: string | number): string | number {
  if (typeof value === "number") return value;
  const texto = value.trim();
  if (!/^-?\d+\.\d+$/.test(texto)) return value;
  return texto.replace(/\.?0+$/, "") || "0";
}

export function toCommercialInput(
  settings: CommercialSettings,
): CommercialSettingsInput {
  const {
    version,
    updated_at: _updatedAt,
    bank_accounts: accounts,
    ...rest
  } = settings;
  const primary =
    accounts.find((account) => account.is_primary) ?? accounts[0] ?? null;

  const numericos = Object.fromEntries(
    NUMERICOS.filter(
      (campo) => rest[campo] !== null && rest[campo] !== undefined,
    ).map((campo) => [campo, sinEscala(rest[campo] as string | number)]),
  );

  return {
    ...rest,
    ...numericos,
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
