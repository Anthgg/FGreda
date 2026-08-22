import gredaLogo from "@/assets/greda-logo.png";

/**
 * Logotipo oficial de GREDA centrado en el Login.
 */
export function BrandMark() {
  return (
    <div className="mb-5 flex justify-center">
      <img
        src={gredaLogo}
        alt="Logo de Greda"
        className="h-12 w-auto object-contain transition-transform duration-300 hover:scale-105"
      />
    </div>
  );
}
