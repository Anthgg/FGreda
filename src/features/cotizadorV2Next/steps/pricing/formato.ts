import { formatDecimalString } from "@/features/firings/labels";

/**
 * «18 %», «18.5 %»: un porcentaje del backend sin ceros de relleno. 010O.10.
 *
 * Se formatea el texto decimal tal cual llega, sin pasar por coma flotante.
 */
export function porcentaje(valor: string | null): string {
  if (valor === null) return "—";
  const texto = formatDecimalString(valor, 2);
  if (texto === "—") return texto;
  return `${texto.replace(/\.?0+$/, "")} %`;
}
