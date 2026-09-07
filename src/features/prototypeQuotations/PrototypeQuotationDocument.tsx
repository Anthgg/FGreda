/**
 * El documento emitido, dentro de la pantalla.
 *
 * Igual que en el Cotizador de producto: el PDF no es un enlace que se abre
 * fuera, es lo que se está mirando. Quien acaba de emitir una cotización quiere
 * ver el papel que va a mandar, no descargarlo para comprobar que salió bien.
 *
 * Se trae como blob y no como `<a href>` a la API por una razón concreta: la
 * petición lleva la sesión y el CSRF del cliente HTTP del proyecto, y un enlace
 * suelto saldría del navegador sin ellos.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchPrototypeQuotationPdf } from "@/api/prototypeQuotations";
import { SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";

interface PrototypeQuotationDocumentProps {
  quotationId: number;
  /** Cambia al cobrar o al anular: el papel se regenera. */
  revision: string;
}

export function PrototypeQuotationDocument({
  quotationId,
  revision,
}: PrototypeQuotationDocumentProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState("cotizacion-prototipo.pdf");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // El blob vive en memoria del navegador hasta que se revoca. Sin esto, cada
  // regeneración dejaría el anterior colgado.
  const anterior = useRef<string | null>(null);

  const generar = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const resultado = await fetchPrototypeQuotationPdf(quotationId);
      const url = URL.createObjectURL(resultado.blob);
      if (anterior.current) URL.revokeObjectURL(anterior.current);
      anterior.current = url;
      setBlobUrl(url);
      setFilename(resultado.filename ?? "cotizacion-prototipo.pdf");
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    void generar();
  }, [generar, revision]);

  useEffect(
    () => () => {
      if (anterior.current) URL.revokeObjectURL(anterior.current);
    },
    [],
  );

  const descargar = () => {
    if (!blobUrl) return;
    const enlace = document.createElement("a");
    enlace.href = blobUrl;
    enlace.download = filename;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
  };

  const abrir = () => {
    if (blobUrl) window.open(blobUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-600">
        <span className="truncate font-medium">{filename}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={abrir}
            disabled={!blobUrl}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 disabled:opacity-40"
          >
            ↗ Abrir pestaña
          </button>
          <button
            type="button"
            onClick={descargar}
            disabled={!blobUrl}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-40"
          >
            ⬇ Descargar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center">
          <Spinner className="size-5" label="Generando el documento…" />
        </div>
      ) : error ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-6 text-center">
          <p role="alert" className="text-sm text-zinc-600">
            No se pudo generar el documento.
          </p>
          <SecondaryButton onClick={() => void generar()}>Reintentar</SecondaryButton>
        </div>
      ) : blobUrl ? (
        // `view=FitH` ajusta la hoja al ANCHO del marco. Sin él, el visor del
        // navegador encaja la página entera y deja franjas grises a los lados
        // y debajo: se ve el visor, no el documento. Con `toolbar=0` y
        // `navpanes=0` ya no hay barra ni panel lateral, así que lo único que
        // queda en pantalla es el papel.
        <iframe
          src={`${blobUrl}#toolbar=0&navpanes=0&view=FitH`}
          title="Cotización de prototipo"
          className="min-h-[520px] w-full border-0 bg-white lg:min-h-[720px]"
        />
      ) : null}
    </section>
  );
}
