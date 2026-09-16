

export function OvenSvg({ percentage }: { percentage: number }) {
  // Limitar visualmente el relleno entre 0 y 110% para que no se salga de la imagen base.
  const visualPercentage = Math.min(Math.max(percentage, 0), 110);

  // SVG de horno minimalista con animación suave de altura
  return (
    <div className="relative w-full max-w-[200px] aspect-[3/4] mx-auto bg-zinc-50 rounded-2xl border border-zinc-200 overflow-hidden flex items-end shadow-inner">
      {/* Relleno de la ocupación */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-emerald-500/20 border-t border-emerald-500/40 transition-all duration-700 ease-in-out"
        style={{ height: `${visualPercentage}%` }}
      />
      
      {/* Contenido (bandejas y estructura interior) */}
      <svg
        className="absolute inset-0 w-full h-full text-zinc-300"
        viewBox="0 0 100 133"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Rejillas horizontales */}
        <line x1="10" y1="20" x2="90" y2="20" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        <line x1="10" y1="80" x2="90" y2="80" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        <line x1="10" y1="110" x2="90" y2="110" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
      </svg>
    </div>
  );
}
