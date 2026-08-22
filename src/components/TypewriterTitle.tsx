import { useEffect, useState } from "react";

import { useReducedMotion } from "@/features/auth/useReducedMotion";

export interface TypewriterTitleProps {
  text?: string;
  className?: string;
}

/**
 * Título de encabezado con efecto máquina de escribir de ejecución única.
 * Escribe el texto caracter a caracter y luego retira el cursor quedando completamente estático.
 */
export function TypewriterTitle({
  text = "Inicio.",
  className = "text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900",
}: TypewriterTitleProps) {
  const reducedMotion = useReducedMotion();
  const [charIndex, setCharIndex] = useState(reducedMotion ? text.length : 0);
  const [showCaret, setShowCaret] = useState(!reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setCharIndex(text.length);
      setShowCaret(false);
      return;
    }

    if (charIndex < text.length) {
      const timer = window.setTimeout(() => {
        setCharIndex((prev) => prev + 1);
      }, 75);
      return () => window.clearTimeout(timer);
    }

    // Al terminar de escribir, mantener el cursor parpadeante durante 1.2s y luego ocultarlo
    const hideTimer = window.setTimeout(() => {
      setShowCaret(false);
    }, 1200);

    return () => window.clearTimeout(hideTimer);
  }, [charIndex, reducedMotion, text]);

  const displayedText = text.slice(0, charIndex);

  return (
    <h1 className={className}>
      <span>{displayedText}</span>
      {showCaret ? (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block w-[2px] h-[0.9em] bg-zinc-900 align-middle animate-pulse"
        />
      ) : null}
    </h1>
  );
}
