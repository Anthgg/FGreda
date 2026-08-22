import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/features/auth/useReducedMotion";

interface Particle {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  color: string;
  velocityX: number;
  velocityY: number;
}

const PARTICLE_COLORS = ["151, 86, 59", "185, 121, 87", "63, 63, 70"] as const;

function createParticle(width: number, height: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.035 + Math.random() * 0.1;

  return {
    x: Math.random() * width,
    y: Math.random() * height,
    radius: 0.55 + Math.random() * 1.25,
    opacity: 0.12 + Math.random() * 0.2,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]!,
    velocityX: Math.cos(angle) * speed,
    velocityY: Math.sin(angle) * speed,
  };
}

function particleCount(width: number, height: number): number {
  const mobile = width < 640;
  const minimum = mobile ? 18 : 42;
  const maximum = mobile ? 56 : 140;
  return Math.min(maximum, Math.max(minimum, Math.floor((width * height) / 13_000)));
}

/** Canvas decorativo de pigmentos suspendidos, aislado del render del formulario. */
export function LoginParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let particles: Particle[] = [];
    const pointer = { x: 0, y: 0, active: false };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        context.beginPath();
        context.fillStyle = `rgba(${particle.color}, ${particle.opacity})`;
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }
    };

    const resize = () => {
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.max(1, Math.floor(width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      particles = Array.from({ length: particleCount(width, height) }, () =>
        createParticle(width, height),
      );
      if (reducedMotion) draw();
    };

    const movePointer = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    };

    const clearPointer = () => {
      pointer.active = false;
    };

    const animate = () => {
      for (const particle of particles) {
        if (pointer.active) {
          const deltaX = particle.x - pointer.x;
          const deltaY = particle.y - pointer.y;
          const distanceSquared = deltaX * deltaX + deltaY * deltaY;
          if (distanceSquared > 0 && distanceSquared < 8_100) {
            const distance = Math.sqrt(distanceSquared);
            const force = (1 - distance / 90) * 0.006;
            particle.velocityX += (deltaX / distance) * force;
            particle.velocityY += (deltaY / distance) * force;
          }
        }

        particle.velocityX = Math.max(-0.28, Math.min(0.28, particle.velocityX * 0.998));
        particle.velocityY = Math.max(-0.28, Math.min(0.28, particle.velocityY * 0.998));
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;

        if (particle.x < -3) particle.x = width + 3;
        if (particle.x > width + 3) particle.x = -3;
        if (particle.y < -3) particle.y = height + 3;
        if (particle.y > height + 3) particle.y = -3;
      }

      draw();
      animationFrame = window.requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    if (!reducedMotion) {
      window.addEventListener("pointermove", movePointer, { passive: true });
      window.addEventListener("pointerout", clearPointer, { passive: true });
      animationFrame = window.requestAnimationFrame(animate);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("pointerout", clearPointer);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 size-full"
    />
  );
}
