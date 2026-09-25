import { useEffect, useId, useRef, useState } from "react";

import { useBorradorProtegido } from "@/components/borradores";
import { etiquetaDeFactor, valoresDeFactor } from "@/features/cotizadorV2/factor";

/**
 * El factor comercial como un deslizador. Fase 010O.10.
 *
 * Recorre solo los factores de `valoresDeFactor` —el rango CONGELADO en la
 * cotización, con su paso—, así que no se puede elegir un valor que el rango no
 * admite ni aparece un ×2–×3 escrito aquí. La marca del «objetivo de la casa»
 * sale de `factor_target`.
 *
 * ## Una escritura por decisión, no por píxel
 *
 * Arrastrar dispara decenas de cambios. Se guarda UNA vez: al soltar, al salir
 * del control, o tras 600 ms sin moverlo (el teclado no «suelta»). Mientras
 * tanto el valor cuenta como borrador: el pie dice «Cambios sin guardar» y, si
 * el paso se desmonta a mitad, el valor se confirma igual.
 *
 * El precio que resulta NO se calcula aquí: aparece cuando el backend responde.
 */

const ESPERA_MS = 600;

export function FactorControl({
  factor,
  minimo,
  maximo,
  objetivo,
  editable,
  fallo,
  onCommit,
}: {
  factor: string | null;
  minimo: string | null;
  maximo: string | null;
  objetivo: string | null;
  editable: boolean;
  /** Si la última escritura del factor falló: el control vuelve a lo guardado. */
  fallo: boolean;
  onCommit: (valor: string) => void;
}) {
  const etiqueta = useId();
  const pista = useId();
  const valores = valoresDeFactor(factor, minimo, maximo);
  const guardado = factor === null ? null : Number(factor);

  // Lo que se está eligiendo ahora, y lo que ya se mandó y aún no ha vuelto.
  const [arrastre, setArrastre] = useState<number | null>(null);
  const [enviado, setEnviado] = useState<number | null>(null);
  const pendiente = useRef<number | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (enviado === null) return;
    if (guardado === enviado || fallo) setEnviado(null);
  }, [guardado, enviado, fallo]);

  const confirmar = () => {
    clearTimeout(temporizador.current);
    const valor = pendiente.current;
    pendiente.current = null;
    setArrastre(null);
    if (valor === null || valor === guardado) return;
    setEnviado(valor);
    onCommit(String(valor));
  };

  // El temporizador llama siempre a la versión más reciente de `confirmar`: la
  // de su render conocería un factor guardado que quizá ya cambió.
  const ultimoConfirmar = useRef(confirmar);
  useEffect(() => {
    ultimoConfirmar.current = confirmar;
  });

  useBorradorProtegido(arrastre !== null, confirmar);
  useEffect(() => () => clearTimeout(temporizador.current), []);

  const mostrado = arrastre ?? enviado ?? guardado;

  if (valores.length === 0) {
    return (
      <p className="text-xs text-amber-800">
        Esta cotización no tiene un rango de factor congelado: revise la configuración comercial.
      </p>
    );
  }

  const indice = mostrado === null ? 0 : Math.max(0, valores.indexOf(mostrado));
  const ultimo = valores.length - 1;
  const posicionObjetivo =
    objetivo !== null && ultimo > 0 ? valores.indexOf(Number(objetivo)) / ultimo : -1;

  return (
    <div data-testid="v2next-factor" className="min-w-0 flex-1">
      <p id={etiqueta} className="text-[13px] text-zinc-600">
        Multiplicar el costo por
      </p>
      <p
        data-testid="v2next-factor-valor"
        className="text-[28px] font-extrabold leading-tight tracking-tight text-zinc-950 tabular-nums"
      >
        {mostrado === null ? "—" : etiquetaDeFactor(mostrado)}
      </p>

      {editable && valores.length > 1 ? (
        <div className="mt-2">
          <input
            type="range"
            min={0}
            max={ultimo}
            step={1}
            value={indice}
            aria-labelledby={etiqueta}
            aria-describedby={pista}
            aria-valuetext={mostrado === null ? "Sin elegir" : etiquetaDeFactor(mostrado)}
            onChange={(evento) => {
              const valor = valores[Number(evento.target.value)];
              if (valor === undefined) return;
              setArrastre(valor);
              pendiente.current = valor;
              clearTimeout(temporizador.current);
              temporizador.current = setTimeout(() => ultimoConfirmar.current(), ESPERA_MS);
            }}
            onPointerUp={confirmar}
            onBlur={confirmar}
            className="w-full cursor-pointer accent-zinc-900"
          />
          <div className="relative mt-1 h-4 text-[11.5px] text-zinc-500">
            <span className="absolute left-0">{etiquetaDeFactor(valores[0] ?? 0)} mínimo</span>
            {posicionObjetivo > 0 && posicionObjetivo < 1 ? (
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${posicionObjetivo * 100}%` }}
              >
                {etiquetaDeFactor(Number(objetivo))} objetivo
              </span>
            ) : null}
            <span className="absolute right-0">
              {etiquetaDeFactor(valores[ultimo] ?? 0)}
              {posicionObjetivo === 1 ? " objetivo" : " máximo"}
            </span>
          </div>
        </div>
      ) : null}

      <p id={pista} className="mt-2 text-[11.5px] text-zinc-500">
        {mostrado === null
          ? "Sin factor todavía: elija uno para que haya precio."
          : "Uno solo para toda la cotización. El mínimo es regla cerrada; el máximo lo fija la configuración."}
      </p>
    </div>
  );
}
