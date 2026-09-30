import { formatDisplayDate } from "@/components/dateFormat";
import type { V2ConfirmationPreview } from "@/types/quoterV2";

/** «Válida hasta el 14/10/2026 si se emite hoy · 20 días». */
export function vigenciaProyectada(resumen: V2ConfirmationPreview): string {
  const hasta = resumen.valid_until ? formatDisplayDate(resumen.valid_until) : null;
  const dias = resumen.validity_days ? `${resumen.validity_days} días` : null;
  if (!hasta) return dias ? `Válida por ${dias}` : "Vigencia por definir";
  return `Válida hasta el ${hasta} si se emite hoy${dias ? ` · ${dias}` : ""}`;
}
