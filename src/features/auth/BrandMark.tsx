import gredaLogo from "@/assets/greda-frame-1.png";

/**
 * Logotipo oficial de GREDA estático, limpio y centrado.
 */
export function BrandMark() {
  return (
    <div className="mb-5 flex items-center justify-center">
      <div className="relative flex size-14 items-center justify-center">
        <img
          src={gredaLogo}
          alt="Logotipo de Greda"
          className="size-14 select-none object-contain transition-transform duration-300 hover:scale-105"
          draggable={false}
        />
      </div>
    </div>
  );
}
