interface SpinnerProps {
  /** Clases de tamano, por ejemplo `size-4`. */
  className?: string;
  label?: string;
}

/** Indicador de progreso indeterminado. */
export function Spinner({ className = "size-4", label }: SpinnerProps) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <svg
        className={`${className} animate-spin text-current`}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2Z"
        />
      </svg>
      {label ? <span>{label}</span> : <span className="sr-only">Cargando</span>}
    </span>
  );
}
