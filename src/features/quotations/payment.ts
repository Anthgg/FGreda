import type { QuotationPaymentStatus, QuotationStatus } from "@/types/quotations";

/**
 * Cómo se dice en pantalla el estado de cobro.
 *
 * Los tres casos se dicen distinto a propósito. «Sin registro de pago» no es
 * «Pendiente de pago»: el primero significa que el sistema no lo sabe —cierto
 * de todo lo anterior a 009H— y el segundo, que se sabe que no se ha cobrado.
 * Traducir `null` a «Pendiente» le pondría a cotizaciones antiguas una
 * afirmación que nadie hizo.
 */
export function describePayment(status: QuotationPaymentStatus | null | undefined): string {
  if (status === "PAID") return "Pagada";
  if (status === "UNPAID") return "Pendiente de pago";
  // `undefined` llega cuando responde un backend anterior a 009H, que no
  // conoce el campo. Dice lo mismo que `null`: el sistema no tiene el dato.
  return "Sin registro de pago";
}

/** Tono visual, siguiendo el vocabulario de insignias que ya usa el módulo. */
export function paymentTone(
  status: QuotationPaymentStatus | null | undefined,
): "positive" | "warning" | "neutral" {
  if (status === "PAID") return "positive";
  if (status === "UNPAID") return "warning";
  return "neutral";
}

/**
 * Si procede ofrecer la acción de cobro.
 *
 * Sólo sobre una confirmada que no esté ya pagada. Un borrador todavía no es
 * un compromiso y una anulada no se cobra; una ya pagada no se vuelve a
 * marcar, porque no hay nada que registrar por segunda vez.
 *
 * Esto NO es la autoridad: el backend rechaza cualquier transición ilegal
 * aunque el botón llegara a aparecer. Aquí sólo se evita ofrecer algo que se
 * sabe que va a fallar.
 */
export function canMarkPaid(
  status: QuotationStatus,
  payment: QuotationPaymentStatus | null,
): boolean {
  return status === "CONFIRMED" && payment !== "PAID";
}

/** Fecha de cobro en el formato corto del módulo, o nada si no la hay. */
export function paymentDate(paidAt: string | null): string | null {
  return paidAt ? paidAt.slice(0, 10) : null;
}
