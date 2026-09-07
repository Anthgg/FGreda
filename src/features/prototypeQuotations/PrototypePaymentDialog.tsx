import { StockLocationDialog } from "@/features/production/StockLocationDialog";

interface Props {
  /** Se cobra al confirmar, con el almacén ya elegido. */
  onConfirm: (stockLocationId: number) => void;
  onClose: () => void;
  pending: boolean;
  error: Error | null;
}

/**
 * Registrar el cobro de una cotización de prototipo. Fase 009K.4.
 *
 * Cobrar dejó de ser un botón y pasó a ser una decisión, porque el cobro
 * materializa la ORDEN DE PRODUCCIÓN de la muestra, y una orden no existe sin
 * saber de qué almacén va a salir su material.
 *
 * La regla de que el almacén no se preselecciona nunca vive en
 * `StockLocationDialog`, que es el único sitio del producto donde se elige uno:
 * repetirla aquí sería tener dos sitios donde relajarla por descuido.
 */
export function PrototypePaymentDialog({ onConfirm, onClose, pending, error }: Props) {
  return (
    <StockLocationDialog
      title="Registrar cobro"
      description={
        "Se dará de alta el producto, la muestra y su orden de producción. No se " +
        "descuenta ningún material: eso ocurre al arrancar la orden."
      }
      confirmLabel="Registrar cobro"
      pendingLabel="Cobrando…"
      onConfirm={onConfirm}
      onClose={onClose}
      pending={pending}
      error={error}
    />
  );
}
