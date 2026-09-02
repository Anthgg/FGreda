import { useEffect, useState } from "react";

import { fetchLogoBlob } from "@/api/settings";
import gredaLogo from "@/assets/greda-frame-1.png";
import { useCompanySettings } from "@/features/settings/useSettings";

interface CompanyLogoProps {
  /** Clases del `img`. Quien lo usa decide el tamaño, que cambia por sitio. */
  className?: string;
}

/**
 * El logo del taller, el mismo que sale impreso en los documentos.
 *
 * Hasta ahora la aplicación mostraba un PNG empaquetado en el build. Eso hacía
 * que cambiar el logo en Configuración cambiara los PDF y **no** la pantalla:
 * dos logos distintos para la misma empresa, y sin ninguna forma de darse
 * cuenta salvo comparándolos a ojo.
 *
 * Ahora se pide el configurado —el mismo binario que embebe la cabecera de
 * cotizaciones y órdenes— y el empaquetado queda como respaldo para cuando no
 * hay ninguno subido todavía. Así la marca se cambia en un sitio.
 *
 * El binario se pide por el cliente HTTP y no con `<img src="/api/...">`
 * porque la ruta exige sesión: una etiqueta `img` no lleva las cookies en
 * todos los contextos y acabaría enseñando una imagen rota.
 */
export function CompanyLogo({ className }: CompanyLogoProps) {
  const company = useCompanySettings();
  // Se extraen los primitivos y no el objeto: `logo` es una referencia nueva
  // en cada refetch de la configuración, así que depender de él volvería a
  // descargar el binario cada vez aunque el logo sea exactamente el mismo.
  const rutaLogo = company.data?.logo?.url ?? null;
  const pesoLogo = company.data?.logo?.size_bytes ?? null;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!rutaLogo) {
      setUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelado = false;

    fetchLogoBlob()
      .then((blob) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        // Un fallo al traer el logo no puede dejar la aplicación sin cabecera:
        // se cae al empaquetado, que es exactamente lo que se veía antes.
        if (!cancelado) setUrl(null);
      });

    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [rutaLogo, pesoLogo]);

  return (
    <img
      src={url ?? gredaLogo}
      alt="Logo de Greda"
      className={className}
      draggable={false}
    />
  );
}
