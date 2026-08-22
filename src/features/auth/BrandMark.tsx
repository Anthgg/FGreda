/**
 * Isotipo circular centrado y compacto de identidad visual para el Login,
 * idéntico en escala y proporción a la referencia del prototipo.
 */
export function BrandMark() {
  return (
    <div className="flex justify-center mb-5">
      <div className="relative flex size-10 items-center justify-center rounded-full shadow-sm">
        <svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="size-10 transition-transform duration-300 hover:scale-105"
        >
          <circle cx="20" cy="20" r="20" fill="url(#greda_brand_gradient)" />
          <path
            d="M20 7.5L23.4 15.5L31.5 16.5L25.3 22.1L27.1 30.5L20 26.2L12.9 30.5L14.7 22.1L8.5 16.5L16.6 15.5L20 7.5Z"
            fill="white"
          />
          <defs>
            <linearGradient
              id="greda_brand_gradient"
              x1="0"
              y1="0"
              x2="40"
              y2="40"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#4285F4" />
              <stop offset="48%" stopColor="#EA4335" />
              <stop offset="100%" stopColor="#FBBC05" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
