/**
 * Motor económico del Cotizador V2: del costo al total.
 *
 * Lo único que el navegador puede DECIDIR aquí es el factor comercial. Todo lo
 * demás son consecuencias: los costos vienen de 010C a 010E y el precio sale de
 * aplicarles ese factor. Un precio unitario tecleado a mano lo desconectaría de
 * los costos que lo explican.
 *
 * ## Cuatro números que no se mezclan
 *
 * - **costo real** — lo que sale del bolsillo, con el GAS que se quema;
 * - **costo de producción** — la base comercial, con la TARIFA de quema;
 * - **precio mínimo** y **precio objetivo** — el suelo y el techo congelados;
 * - **precio negociado** — el del factor elegido hoy.
 *
 * Esconderlos dentro de un único total haría imposible saber si una venta está
 * por encima del suelo, que es la pregunta que el taller hace siempre.
 *
 * Nada de esto va al PDF del cliente: el documento comercial lleva producto,
 * cantidad, medidas, precio unitario, subtotal, IGV y total, y es de 010H.
 */

export interface V2PricingLine {
  line_id: number;
  product_name: string | null;
  quantity: number;

  /** Lo que cuesta la pieza por sí misma: materiales más su mano de obra. */
  direct_cost: string;
  /** Lo que absorbe de lo que es de la cotización entera. Tres bases: la quema
   *  por volumen, el espacio por horas y lo general por costo directo. */
  firing_cost: string;
  gas_cost: string;
  space_cost: string;
  general_cost: string;
  /** Las dos bases de la línea: una con la tarifa de quema, otra con el gas. */
  production_cost: string;
  real_cost: string;

  line_price: string;
  unit_price_raw: string;
  /** El que ve el cliente: múltiplo del escalón comercial, hacia arriba. */
  unit_price: string;
  line_subtotal: string;
  line_tax: string;
  line_total: string;
  /** Subtotal en moneda base menos costo real. Puede ser negativo. */
  profit: string;
}

export interface V2Pricing {
  materials_cost: string;
  labor_cost: string;
  illustration_cost: string;
  space_cost: string;
  administration_cost: string;
  /** Lo que de verdad se quema frente a lo que se cobra por encender. */
  gas_cost: string;
  firing_commercial_cost: string;
  firing_difference: string;

  direct_cost: string;
  /** Las DOS bases. Su diferencia es exactamente la de la quema. */
  real_cost: string;
  production_cost: string;

  commercial_factor: string | null;
  factor_min: string | null;
  factor_max: string | null;
  price_min: string;
  price_target: string;
  negotiated_price: string;

  currency_code: string | null;
  exchange_rate: string | null;
  tax_percent: string | null;
  rounding_step: string | null;
  /** Reconstruido sumando las líneas ya redondeadas. */
  subtotal: string;
  tax: string;
  total: string;
  /** Lo que el redondeo añadió sobre el precio negociado. */
  rounding_adjustment: string;

  /** Precio comercial SIN IGV menos costo REAL. Puede ser negativo. */
  estimated_profit: string;
  /** Sobre el precio, no sobre el costo. */
  effective_margin_percent: string;

  lines: V2PricingLine[];
  warnings: string[];
}

export interface V2PricingInput {
  /** Factor, no porcentaje: 3 significa ×3. */
  commercial_factor?: string;
}

/** Los avisos que devuelve el backend, en lenguaje de taller. */
export const PRICING_WARNING_LABEL: Record<string, string> = {
  V2_PRICING_FACTOR_NOT_SET:
    "Esta cotización todavía no tiene factor comercial, así que no hay precio que calcular.",
  V2_PRICING_TAX_NOT_SET:
    "La configuración de la empresa no declara IGV. Se costea sin impuesto hasta que se ponga.",
  V2_PRICING_ROUNDING_NOT_SET:
    "No hay escalón de redondeo configurado. El precio unitario sale sin redondear.",
  V2_PRICING_NO_LINES: "La cotización todavía no tiene productos.",
  V2_PRICING_NO_COST: "Todavía no hay costo que valorizar.",
  V2_PRICING_WORK_DAYS_NOT_SET:
    "Faltan los días efectivos de taller. Sin ellos el espacio no entra en el costo, y lo decide usted.",
  V2_PRICING_LINE_WITHOUT_QUANTITY:
    "Alguna línea no tiene piezas y por eso no lleva importe. Revise si falta la cantidad.",
  V2_PRICING_SELLING_BELOW_REAL_COST:
    "El precio está por debajo del costo real: esta cotización se vendería a pérdida.",
};
