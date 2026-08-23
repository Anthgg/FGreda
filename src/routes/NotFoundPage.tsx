import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="w-full space-y-4">
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Pagina no encontrada
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        La ruta solicitada no existe.
      </p>
      <Link
        to="/"
        className="mt-4 inline-block text-sm font-medium text-clay-700 hover:underline dark:text-clay-300"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
