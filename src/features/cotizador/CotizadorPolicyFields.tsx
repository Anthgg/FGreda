import type { ReactNode } from "react";

import { SelectField, TextField } from "@/components/form";
import type { SelectOption } from "@/components/form";
import {
  NEUTRAL_FACTOR,
  PRODUCTION_FACTOR_LABEL,
  factorMultiplier,
} from "@/features/cotizador/productionFactor";
import type { KilnMode } from "@/types/quotationBuilder";

/**
 * Fase 009K.3. Las dos decisiones nuevas de la cotizacion.
 *
 * Se resuelven con radios y no con el `SelectField` de la casa a proposito:
 * son dos opciones excluyentes que conviene ver a la vez. Un desplegable
 * esconde la alternativa detras de un clic, y aqui la alternativa es
 * justamente lo que hay que comparar.
 */

function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  disabled,
  onChange,
  children,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly { value: T; label: string }[];
  disabled: boolean;
  onChange: (value: T) => void;
  /**
   * Lo que explica la eleccion. Va DENTRO del `fieldset` a proposito: la
   * leyenda nombra al grupo entero, asi que la ayuda y el numero quedan
   * atados al control tambien para quien navega por accesibilidad.
   */
  children?: ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-xs font-semibold text-zinc-900">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={[
              "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
              value === option.value
                ? "border-orange-300 bg-orange-50 text-orange-950"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="h-3.5 w-3.5 accent-orange-600"
            />
            {option.label}
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}

/**
 * Fase 009K.4.2: el factor es opcional y, cuando se aplica, su valor es
 * editable por cotizacion. Configuracion solo da la sugerencia inicial.
 */
export function ProductionFactorField({
  enabled,
  configuredFactor,
  value,
  disabled,
  onChange,
  onValueChange,
}: {
  enabled: boolean;
  configuredFactor: string | null | undefined;
  value: string;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
  onValueChange: (value: string) => void;
}) {
  const effectiveValue = value.trim() || factorMultiplier(configuredFactor);
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-5">
      <Segmented
        legend={PRODUCTION_FACTOR_LABEL}
        name="production-factor-enabled"
        value={enabled ? "SI" : "NO"}
        options={[
          { value: "NO", label: "Desactivado" },
          { value: "SI", label: "Activado" },
        ]}
        disabled={disabled}
        onChange={(value) => onChange(value === "SI")}
      >
        <p className="mt-3 text-xs text-zinc-600">
          {enabled
            ? "Se aplica el factor elegido para esta cotización."
            : "No se aplica multiplicador de producción."}
        </p>
        {enabled ? (
          <TextField
            label="Valor del factor"
            requirement="required"
            value={value}
            onChange={onValueChange}
            disabled={disabled}
            inputMode="decimal"
            placeholder={factorMultiplier(configuredFactor)}
            hint={`Sugerido por Configuración: ×${factorMultiplier(configuredFactor)}. Valor efectivo: ×${effectiveValue}.`}
          />
        ) : (
          <p className="mt-2 text-xs text-zinc-600">
            Factor efectivo:{" "}
            <span className="font-semibold tabular-nums text-zinc-900">×{NEUTRAL_FACTOR}</span>
          </p>
        )}
      </Segmented>
    </div>
  );
}

/**
 * Como se carga el horno: todo junto en una hornada compartida, o una hornada
 * por producto.
 *
 * «Todo junto» es lo que el Cotizador ha hecho siempre y sigue siendo lo
 * predeterminado. «Por producto» hace que cada pieza pague su quema entera
 * aunque comparta horno con otra — no es un error de cuenta, es lo que
 * significa no compartir hornada, y por eso se dice aqui y no solo en el
 * total.
 */
export function KilnModeField({
  mode,
  commonKilnId,
  kilnOptions,
  disabled,
  onModeChange,
  onCommonKilnChange,
}: {
  mode: KilnMode;
  commonKilnId: string;
  kilnOptions: readonly SelectOption[];
  disabled: boolean;
  onModeChange: (mode: KilnMode) => void;
  onCommonKilnChange: (kilnId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Segmented
          legend="Modo de horno"
          name="kiln-mode"
          value={mode}
          options={[
            { value: "TOGETHER", label: "Todo junto" },
            { value: "PER_PRODUCT", label: "Por producto" },
          ]}
          disabled={disabled}
          onChange={onModeChange}
        />
        {mode === "TOGETHER" ? (
          <div className="w-full sm:w-64">
            <SelectField
              label="Horno de la cotización"
              requirement="required"
              value={commonKilnId}
              options={kilnOptions}
              onChange={onCommonKilnChange}
              disabled={disabled}
              placeholder="Elegir horno…"
              // Al volver de «por producto» con hornos distintos, el campo
              // queda vacio a proposito: elegir el primero cambiaria de horno
              // —y de tarifa, hornadas y dias— las demas piezas sin decirlo.
              hint="Todas las piezas se cargan con este horno."
            />
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-zinc-600">
        {mode === "TOGETHER"
          ? "Las piezas comparten hornada: el volumen se suma y la quema se reparte entre ellas."
          : "Cada pieza planifica su propia hornada y paga la quema entera, aunque comparta horno con otra."}
      </p>
    </div>
  );
}
