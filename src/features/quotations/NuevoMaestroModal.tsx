/**
 * Alta rápida de una técnica o un adicional desde el propio cotizador.
 *
 * Existe para no romper el hilo de trabajo: si al cotizar falta un vidriado o
 * una técnica, obligar a abandonar el formulario a medias, ir a otro panel y
 * volver a empezar es la forma más segura de que se capture mal.
 *
 * Pide solo lo que la fórmula necesita. El resto de la ficha —notas, archivar—
 * se edita donde corresponde, en «Maestros de costos».
 */

import { useState } from "react";

import { PrimaryButton, SecondaryButton, SelectField, TextField } from "@/components/form";
import { describeError } from "@/features/settings/messages";
import { useSaveAdditional, useSaveTechnique } from "@/features/quotations/useQuotations";
import type {
  AdditionalFormulaType,
  AdditionalOut,
  TechniqueFormulaType,
  TechniqueOut,
} from "@/types/quotations";

const DECIMAL = /^\d+(\.\d+)?$/;

const esImporte = (valor: string) => DECIMAL.test(valor.trim());
const esFactor = (valor: string) => DECIMAL.test(valor.trim()) && Number(valor) > 0;

interface NuevoMaestroModalProps {
  tipo: "technique" | "additional";
  initialName: string;
  onClose: () => void;
  onCreated: (item: TechniqueOut | AdditionalOut) => void;
}

export function NuevoMaestroModal({
  tipo,
  initialName,
  onClose,
  onCreated,
}: NuevoMaestroModalProps) {
  const esTecnica = tipo === "technique";

  const [name, setName] = useState(initialName.trim());
  const [unitPrice, setUnitPrice] = useState("");
  const [tecnicaFormula, setTecnicaFormula] = useState<TechniqueFormulaType>("ONE_FACTOR");
  const [adicionalFormula, setAdicionalFormula] =
    useState<AdditionalFormulaType>("PIECE_QUANTITY");
  const [factor1, setFactor1] = useState("");
  const [factor2, setFactor2] = useState("");

  const guardarTecnica = useSaveTechnique();
  const guardarAdicional = useSaveAdditional();
  const guardando = guardarTecnica.isPending || guardarAdicional.isPending;
  const error = guardarTecnica.error ?? guardarAdicional.error;

  // Una cantidad simple no lleva factor: pedirlo sería pedir un dato que la
  // fórmula no usa.
  const necesitaFactor = esTecnica || adicionalFormula !== "SIMPLE_QUANTITY";
  const necesitaFactor2 = esTecnica && tecnicaFormula === "TWO_FACTORS";

  const valido =
    name.trim() !== "" &&
    esImporte(unitPrice) &&
    (!necesitaFactor || esFactor(factor1)) &&
    (!necesitaFactor2 || esFactor(factor2));

  const guardar = () => {
    if (!valido) return;
    if (esTecnica) {
      guardarTecnica.mutate(
        {
          id: undefined,
          payload: {
            name: name.trim(),
            unit_price: unitPrice.trim(),
            formula_type: tecnicaFormula,
            factor_1: factor1.trim(),
            factor_2: tecnicaFormula === "TWO_FACTORS" ? factor2.trim() : null,
            active: true,
            notes: null,
          },
        },
        { onSuccess: (creada) => onCreated(creada) },
      );
      return;
    }
    guardarAdicional.mutate(
      {
        id: undefined,
        payload: {
          name: name.trim(),
          unit_price: unitPrice.trim(),
          formula_type: adicionalFormula,
          factor_1: necesitaFactor ? factor1.trim() : null,
          active: true,
          notes: null,
        },
      },
      { onSuccess: (creado) => onCreated(creado) },
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={esTecnica ? "Nueva técnica" : "Nuevo adicional"}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/30 p-4 backdrop-blur-sm"
    >
      <div className="my-12 w-full max-w-xl rounded-3xl border border-white/60 bg-white p-5 shadow-xl sm:p-6">
        <header className="mb-4">
          <h2 className="text-base font-semibold text-zinc-900">
            {esTecnica ? "Nueva técnica" : "Nuevo adicional"}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Se guarda en el maestro y queda disponible para las próximas cotizaciones.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nombre" requirement="required" value={name} onChange={setName} />
          <TextField
            label="Precio unitario"
            requirement="required"
            value={unitPrice}
            onChange={setUnitPrice}
            inputMode="decimal"
            error={unitPrice && !esImporte(unitPrice) ? "Introduzca un importe válido." : undefined}
          />
          {esTecnica ? (
            <SelectField
              label="Fórmula"
              value={tecnicaFormula}
              options={[
                { value: "ONE_FACTOR", label: "Un factor" },
                { value: "TWO_FACTORS", label: "Dos factores" },
              ]}
              onChange={(valor: TechniqueFormulaType) => setTecnicaFormula(valor)}
            />
          ) : (
            <SelectField
              label="Fórmula"
              value={adicionalFormula}
              options={[
                { value: "PIECE_QUANTITY", label: "Una aplicación cada N piezas" },
                { value: "SIMPLE_QUANTITY", label: "Precio por cantidad indicada" },
                { value: "PIECE_X_ADDITIONAL", label: "Cada N piezas, por la cantidad indicada" },
              ]}
              onChange={(valor: AdditionalFormulaType) => setAdicionalFormula(valor)}
            />
          )}
          {necesitaFactor ? (
            <TextField
              label={esTecnica ? "Factor 1" : "Cada cuántas piezas"}
              requirement="required"
              value={factor1}
              onChange={setFactor1}
              inputMode="decimal"
              hint={esTecnica ? undefined : "Por ejemplo, 50: una aplicación cada 50 piezas."}
              error={factor1 && !esFactor(factor1) ? "Introduzca un número mayor que cero." : undefined}
            />
          ) : null}
          {necesitaFactor2 ? (
            <TextField
              label="Factor 2"
              requirement="required"
              value={factor2}
              onChange={setFactor2}
              inputMode="decimal"
              error={factor2 && !esFactor(factor2) ? "Introduzca un número mayor que cero." : undefined}
            />
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-xs text-red-600">
            {describeError(error)}
          </p>
        ) : null}

        <footer className="mt-5 flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4">
          <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          <PrimaryButton type="button" disabled={!valido || guardando} onClick={guardar}>
            {guardando ? "Guardando…" : "Crear y usar"}
          </PrimaryButton>
        </footer>
      </div>
    </div>
  );
}
