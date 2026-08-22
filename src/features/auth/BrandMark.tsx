import { useEffect, useState } from "react";

import frame1 from "@/assets/greda-frame-1.png";
import frame2 from "@/assets/greda-frame-2.png";
import { useReducedMotion } from "@/features/auth/useReducedMotion";

/**
 * Logotipo oficial de GREDA con animación stop-motion artesanal
 * alternando entre las dos variantes de trazo original de la marca.
 */
export function BrandMark() {
  const reducedMotion = useReducedMotion();
  const [activeFrame, setActiveFrame] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;

    const interval = window.setInterval(() => {
      setActiveFrame((current) => (current === 0 ? 1 : 0));
    }, 420);

    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  const currentFrame = activeFrame === 0 ? frame1 : frame2;

  return (
    <div className="mb-5 flex justify-center items-center">
      <div className="relative flex size-14 items-center justify-center">
        <img
          src={currentFrame}
          alt="Logotipo de Greda"
          className="size-14 object-contain transition-transform duration-300 hover:scale-110 select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}
