import { useEffect, useState } from "react";

import { useReducedMotion } from "@/features/auth/useReducedMotion";

interface TypewriterState {
  phraseIndex: number;
  characterIndex: number;
  deleting: boolean;
  settled: boolean;
}

const INITIAL_STATE: TypewriterState = {
  phraseIndex: 0,
  characterIndex: 0,
  deleting: false,
  settled: false,
};

/** Reproduce una vuelta tranquila por las frases y luego queda estable. */
export function useTypewriter(phrases: readonly string[]): string {
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<TypewriterState>(INITIAL_STATE);
  const firstPhrase = phrases[0] ?? "";
  const activePhrase = phrases[state.phraseIndex] ?? firstPhrase;

  useEffect(() => {
    if (reducedMotion || state.settled || phrases.length === 0) return;

    let delay = state.deleting ? 34 : 68;
    let nextState: TypewriterState;

    if (!state.deleting && state.characterIndex < activePhrase.length) {
      nextState = { ...state, characterIndex: state.characterIndex + 1 };
    } else if (!state.deleting) {
      delay = 1_650;
      nextState = { ...state, deleting: true };
    } else if (state.characterIndex > 0) {
      nextState = { ...state, characterIndex: state.characterIndex - 1 };
    } else if (state.phraseIndex < phrases.length - 1) {
      delay = 320;
      nextState = {
        phraseIndex: state.phraseIndex + 1,
        characterIndex: 0,
        deleting: false,
        settled: false,
      };
    } else {
      delay = 320;
      nextState = {
        phraseIndex: 0,
        characterIndex: firstPhrase.length,
        deleting: false,
        settled: true,
      };
    }

    const timer = window.setTimeout(() => setState(nextState), delay);
    return () => window.clearTimeout(timer);
  }, [activePhrase, firstPhrase.length, phrases.length, reducedMotion, state]);

  if (reducedMotion) return firstPhrase;
  return activePhrase.slice(0, state.characterIndex);
}
