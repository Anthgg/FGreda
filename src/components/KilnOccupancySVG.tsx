export function KilnOccupancySVG({ occupancyPercent, label }: { occupancyPercent: number; label?: string }) {
  // occupancyPercent can be up to 100.
  const fillHeight = Math.min(100, Math.max(0, occupancyPercent));
  const isFull = fillHeight >= 99;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-32">
        {/* Horno Base (Background) */}
        <svg viewBox="0 0 100 120" className="w-full h-full text-zinc-100 drop-shadow-sm" fill="currentColor">
          <rect x="10" y="20" width="80" height="90" rx="8" className="stroke-zinc-300" strokeWidth="3" />
          <path d="M10 28 Q 50 10 90 28" fill="none" className="stroke-zinc-300" strokeWidth="3" />
          <line x1="25" y1="20" x2="25" y2="110" className="stroke-zinc-200" strokeWidth="1" />
          <line x1="75" y1="20" x2="75" y2="110" className="stroke-zinc-200" strokeWidth="1" />
        </svg>

        {/* Fill Level */}
        <div 
          className="absolute bottom-2 left-3 right-3 rounded-b-md overflow-hidden" 
          style={{ height: 'calc(100% - 24px)', zIndex: 10 }}
        >
          <div 
            className="absolute bottom-0 w-full bg-orange-400/80 transition-all duration-700 ease-out flex items-end justify-center pb-2"
            style={{ height: `${fillHeight}%` }}
          >
            {/* Opcional: animar fuego o dejar color solido */}
            {fillHeight > 10 && (
               <div className="w-full h-full bg-gradient-to-t from-orange-600/50 to-transparent"></div>
            )}
          </div>
        </div>

        {/* Cúpula del horno (Foreground) para dar efecto 3D simple */}
        <svg viewBox="0 0 100 120" className="w-full h-full absolute inset-0 pointer-events-none" fill="none" style={{ zIndex: 20 }}>
          <rect x="10" y="20" width="80" height="90" rx="8" className="stroke-zinc-400/50" strokeWidth="3" />
          <path d="M5 25 L 95 25" className="stroke-zinc-400" strokeWidth="4" strokeLinecap="round" />
          {/* Panel de control */}
          <rect x="85" y="40" width="10" height="30" rx="2" fill="white" className="stroke-zinc-300" strokeWidth="1" />
          <circle cx="90" cy="45" r="2" fill="#ef4444" />
          <circle cx="90" cy="55" r="2" fill="#22c55e" />
          <circle cx="90" cy="65" r="2" fill="#3b82f6" />
        </svg>
      </div>
      
      <div className="mt-2 text-center">
        <span className="block text-xl font-bold text-zinc-900">{occupancyPercent.toFixed(1)}%</span>
        {label && <span className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500">{label}</span>}
        {isFull && <span className="block text-[10px] text-orange-600 font-bold mt-1">HORNADA LLENA</span>}
      </div>
    </div>
  );
}
