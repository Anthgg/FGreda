/**
 * Marca visual provisional y aislada para poder sustituirla por el logotipo
 * definitivo sin alterar el formulario.
 */
export function BrandMark() {
  return (
    <div className="inline-flex items-center gap-3 text-left">
      <span
        aria-hidden="true"
        className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-zinc-900 text-xl font-semibold text-white shadow-sm"
      >
        G
        <span className="absolute inset-x-2 bottom-1.5 h-px rounded-full bg-clay-300/80" />
      </span>
      <span>
        <span className="block text-base font-semibold tracking-[0.26em] text-zinc-950">GREDA</span>
        <span className="mt-0.5 block text-sm text-zinc-500">Cotización y taller</span>
      </span>
    </div>
  );
}
