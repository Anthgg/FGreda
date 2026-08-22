import { useEffect, useState } from "react";

import { useReducedMotion } from "@/features/auth/useReducedMotion";

interface TypewriterState {
  phraseIndex: number;
  characterIndex: number;
  deleting: boolean;
}

const INITIAL_STATE: TypewriterState = {
  phraseIndex: 0,
  characterIndex: 0,
  deleting: false,
};

/**
 * Hook para efecto máquina de escribir continuo con pausas naturales
 * y soporte para preferencias de reducción de movimiento.
 */
export function useTypewriter(phrases: readonly string[]): string {
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<TypewriterState>(INITIAL_STATE);

  const firstPhrase = phrases[0] ?? "";
  const activePhrase = phrases[state.phraseIndex] ?? firstPhrase;

  useEffect(() => {
    if (reducedMotion || phrases.length === 0) return;

    let delay = state.deleting ? 40 : 90;
    let nextState: TypewriterState;

    if (!state.deleting && state.characterIndex < activePhrase.length) {
      // Escribiendo caracter a caracter
      nextState = {
        ...state,
        characterIndex: state.characterIndex + 1,
      };
    } else if (!state.deleting && state.characterIndex === activePhrase.length) {
      // Frase completa: pausa antes de comenzar a borrar
      delay = 2000;
      nextState = {
        ...state,
        deleting: true,
      };
    } else if (state.deleting && state.characterIndex > 0) {
      // Borrando caracter a caracter
      nextState = {
        ...state,
        characterIndex: state.characterIndex - 1,
      };
    } else {
      // Frase borrada por completo: pausa breve y pasar a la siguiente frase
      delay = 400;
      nextState = {
        phraseIndex: (state.phraseIndex + 1) % phrases.length,
        characterIndex: 0,
        deleting: false,
      };
    }

    const timer = window.setTimeout(() => setState(nextState), delay);
    return () => window.clearTimeout(timer);
  }, [activePhrase, phrases.length, reducedMotion, state]);

  if (reducedMotion) return firstPhrase;
  return activePhrase.slice(0, state.characterIndex);
}
