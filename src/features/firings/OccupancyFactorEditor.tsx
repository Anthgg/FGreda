import { PrimaryButton, SecondaryButton, TextField } from "@/components/form";
import {
  validateFactorRows,
  type FactorRow,
} from "@/features/firings/occupancyFactors";

/**
 * Editor de la tabla de factores de ocupación de un horno.
 *
 * Sin esta tabla el horno no sirve: una quema no puede usarlo. Antes se podía
 * crear un horno desde la aplicación y la propia interfaz avisaba de que había
 * que "configurarla", pero no existía ninguna pantalla para hacerlo — el
 * endpoint estaba, sin nadie que lo llamara.
 *
 * El dominio NO exige diez tramos de 10 %. Lo que el backend valida es que la
 * tabla empiece en 1 %, termine en 100 %, cubra el rango de forma contigua sin
 * huecos ni solapamientos, y que cada tramo lleve un factor válido. Cualquier
 * reparto que cumpla eso vale: cuatro tramos desiguales son igual de legítimos
 * que diez de 10 %.
 *
 * Los diez tramos de 10 % son solo la plantilla con la que arranca esta
 * pantalla, por ser la forma que ya usan los hornos del taller. Se pueden
 * añadir, quitar y redefinir. Los multiplicadores llegan VACÍOS a propósito:
 * son un dato del taller y esta pantalla no se los inventa.
 */

interface Props {
  rows: FactorRow[];
  onChange: (rows: FactorRow[]) => void;
  disabled?: boolean | undefined;
  /** Error devuelto por el backend, que manda sobre la validación local. */
  serverError?: string | undefined;
}

export function OccupancyFactorEditor({ rows, onChange, disabled, serverError }: Props) {
  const localError = validateFactorRows(rows);
  const patch = (index: number, values: Partial<FactorRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...values } : row)));

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-zinc-500">
        Multiplicador del costo según cuánto horno ocupe la pieza. Debe cubrir de 1 % a 100 %
        sin huecos.
      </p>
      <div className="space-y-1.5">
        {rows.map((row, index) => (
          <div key={`${row.min}-${index}`} className="grid grid-cols-3 gap-2">
            <TextField
              label={index === 0 ? "Desde (%)" : ""}
              value={row.min}
              onChange={(value) => patch(index, { min: value })}
              inputMode="numeric"
              disabled={disabled}
            />
            <TextField
              label={index === 0 ? "Hasta (%)" : ""}
              value={row.max}
              onChange={(value) => patch(index, { max: value })}
              inputMode="numeric"
              disabled={disabled}
            />
            <TextField
              label={index === 0 ? "Factor" : ""}
              value={row.factor}
              onChange={(value) => patch(index, { factor: value })}
              inputMode="decimal"
              placeholder="Ej. 1.5"
              disabled={disabled}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <SecondaryButton
          onClick={() => onChange([...rows, { min: "", max: "", factor: "" }])}
          disabled={disabled}
        >
          Añadir tramo
        </SecondaryButton>
        {rows.length > 1 ? (
          <SecondaryButton onClick={() => onChange(rows.slice(0, -1))} disabled={disabled}>
            Quitar último
          </SecondaryButton>
        ) : null}
      </div>
      {serverError ? (
        <p role="alert" className="text-[11px] font-semibold text-red-600">
          {serverError}
        </p>
      ) : localError ? (
        <p className="text-[11px] text-amber-700">{localError}</p>
      ) : null}
    </div>
  );
}

interface SaveProps {
  rows: FactorRow[];
  onSave: () => void;
  pending: boolean;
  label?: string;
}

export function SaveFactorsButton({ rows, onSave, pending, label = "Guardar factores" }: SaveProps) {
  return (
    <PrimaryButton
      type="button"
      onClick={onSave}
      disabled={pending || validateFactorRows(rows) !== null}
    >
      {label}
    </PrimaryButton>
  );
}
