/**
 * Menu principal previsto para todo el producto.
 *
 * `Inicio` y `Configuracion` estan operativos. El resto queda visible y
 * deshabilitado para fijar la estructura de navegacion: su logica de negocio
 * corresponde a fases posteriores y no se adelanta aqui.
 */

export interface NavigationItem {
  label: string;
  /** Ruta destino. Ausente mientras el modulo no exista. */
  to?: string;
  /** Fase del plan en la que se implementa. */
  enabled: boolean;
}

export const NAVIGATION: readonly NavigationItem[] = [
  { label: "Inicio", to: "/", enabled: true },
  { label: "Productos", enabled: false },
  { label: "Inventario", enabled: false },
  { label: "Recetas", enabled: false },
  { label: "Quemas", enabled: false },
  { label: "Cotizaciones", enabled: false },
  { label: "Configuracion", to: "/configuracion", enabled: true },
];
