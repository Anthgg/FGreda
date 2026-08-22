import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/features/auth/useReducedMotion";

const PARTICLE_COLORS = [
  "#4285F4", // Azul
  "#EA4335", // Rojo
  "#FBBC05", // Amarillo
  "#34A853", // Verde
  "#8B5CF6", // Violeta
  "#F43F5E", // Rosa / Coral
  "#10B981", // Esmeralda
] as const;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  density: number;
  angle: number;
}

export interface GredaParticleBackgroundProps {
  /**
   * Modo de intensidad visual:
   * - "login": 100% densidad y velocidad (pantalla completa de autenticación).
   * - "dashboard": 40%-60% densidad y velocidad atenuada para no competir con el contenido de trabajo.
   */
  variant?: "login" | "dashboard";
  className?: string;
}

function createParticle(width: number, height: number, speedFactor: number): Particle {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 1.2 * speedFactor,
    vy: (Math.random() - 0.5) * 1.2 * speedFactor,
    size: Math.random() * 2.2 + 0.8,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]!,
    density: Math.random() * 25 + 2,
    angle: Math.random() * Math.PI * 2,
  };
}

function calculateParticleCount(width: number, height: number, isDashboard: boolean): number {
  const isMobile = width < 640;
  if (isDashboard) {
    const min = isMobile ? 20 : 45;
    const max = isMobile ? 35 : 75;
    return Math.min(max, Math.max(min, Math.floor((width * height) / 16000)));
  }
  const min = isMobile ? 35 : 90;
  const max = isMobile ? 65 : 150;
  return Math.min(max, Math.max(min, Math.floor((width * height) / 7500)));
}

/**
 * Fondo interactivo Canvas 2D con partículas multicolor flotantes para Cotizador GREDA.
 */
export function GredaParticleBackground({
  variant = "login",
  className = "pointer-events-none fixed inset-0 -z-10 size-full",
}: GredaParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();
  const isDashboard = variant === "dashboard";

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let clickTimeout = 0;
    let particles: Particle[] = [];

    const speedFactor = isDashboard ? 0.65 : 1.0;
    const repulsionRadius = isDashboard ? 130 : 160;

    const mouse: { x: number | null; y: number | null; radius: number } = {
      x: null,
      y: null,
      radius: repulsionRadius,
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      ctx.globalAlpha = isDashboard ? 0.75 : 1.0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        ctx.beginPath();
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        // Pequeño trazo rectangular como en el prototipo
        ctx.fillRect(-p.size, -p.size / 4, p.size * 2, p.size / 2);
        ctx.restore();
        ctx.closePath();
      }

      ctx.globalAlpha = 1.0;
    };

    const resize = () => {
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.max(1, Math.floor(width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(height * pixelRatio));
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const count = calculateParticleCount(width, height, isDashboard);
      particles = Array.from({ length: count }, () => createParticle(width, height, speedFactor));

      if (reducedMotion) {
        draw();
      }
    };

    const handleClick = (event: MouseEvent) => {
      // Si estamos en el dashboard, no reaccionar si el clic fue en un input, botón, enlace o elemento de formulario
      if (isDashboard) {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.closest("button") ||
            target.closest("a") ||
            target.closest("input") ||
            target.closest("select") ||
            target.closest("textarea") ||
            target.closest("nav"))
        ) {
          return;
        }
      }

      mouse.x = event.clientX;
      mouse.y = event.clientY;

      window.clearTimeout(clickTimeout);
      clickTimeout = window.setTimeout(() => {
        mouse.x = null;
        mouse.y = null;
      }, 120);
    };

    const animate = () => {
      const maxSpeed = 1.2 * speedFactor;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;

        // Movimiento base
        p.x += p.vx;
        p.y += p.vy;

        // Rebote en bordes de la ventana
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Interacción de repulsión por clic
        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist < mouse.radius && dist > 0) {
            const force = (mouse.radius - dist) / mouse.radius;
            const forceDirX = dx / dist;
            const forceDirY = dy / dist;

            const pushMultiplier = isDashboard ? 1.8 : 2.5;
            p.x -= forceDirX * force * p.density * pushMultiplier;
            p.y -= forceDirY * force * p.density * pushMultiplier;
            p.vx += (Math.random() - 0.5) * (isDashboard ? 1.0 : 1.5);
            p.vy += (Math.random() - 0.5) * (isDashboard ? 1.0 : 1.5);
          }
        }

        // Amortiguación hacia velocidad natural
        if (p.vx > maxSpeed || p.vx < -maxSpeed) p.vx *= 0.96;
        if (p.vy > maxSpeed || p.vy < -maxSpeed) p.vy *= 0.96;
      }

      draw();
      animationFrame = window.requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    if (!reducedMotion) {
      window.addEventListener("click", handleClick, { passive: true });
      animationFrame = window.requestAnimationFrame(animate);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(clickTimeout);
      window.removeEventListener("resize", resize);
      window.removeEventListener("click", handleClick);
    };
  }, [isDashboard, reducedMotion]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
