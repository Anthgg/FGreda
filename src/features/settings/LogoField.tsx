import { useEffect, useRef, useState } from "react";

import { fetchLogoBlob } from "@/api/settings";
import { SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import { useDeleteLogo, useUploadLogo } from "@/features/settings/useSettings";
import type { LogoInfo } from "@/types/settings";

const ACCEPTED = "image/png,image/jpeg,image/webp";

interface LogoFieldProps {
  logo: LogoInfo | null;
  canEdit: boolean;
}

/**
 * Vista previa y gestión del logo de la empresa para documentos.
 */
export function LogoField({ logo, canEdit }: LogoFieldProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useUploadLogo();
  const remove = useDeleteLogo();

  useEffect(() => {
    if (!logo) {
      setPreviewUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    fetchLogoBlob()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(describeError(error));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [logo]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(file, {
      onSettled: () => {
        if (inputRef.current) inputRef.current.value = "";
      },
    });
  };

  const busy = upload.isPending || remove.isPending;
  const actionError = upload.error ?? remove.error;

  return (
    <section className="border-t border-zinc-200/80 pt-6">
      <div className="mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Logo de Empresa
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Logo utilizado para membretes y encabezados de documentos oficiales.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-5">
        {/* Contenedor de Vista Previa */}
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
          {isLoading ? (
            <Spinner className="size-5" />
          ) : previewUrl ? (
            <img src={previewUrl} alt="Logo de la empresa" className="max-h-full max-w-full object-contain p-2" />
          ) : (
            <span className="px-2 text-center text-xs text-zinc-400">
              Sin logo
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {logo ? (
            <p className="text-xs font-medium text-zinc-700">
              {logo.content_type} · {(logo.size_bytes / 1024).toFixed(0)} KB
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              Todavía no se ha cargado ningún logo.
            </p>
          )}

          {canEdit ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-xs transition-colors hover:bg-black cursor-pointer">
                  <span>{logo ? "Cambiar archivo" : "Elegir archivo"}</span>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED}
                    disabled={busy}
                    aria-label="Seleccionar archivo de logo"
                    onChange={(event) => handleFile(event.target.files?.[0])}
                    className="sr-only"
                  />
                </label>

                {logo ? (
                  <SecondaryButton disabled={busy} onClick={() => remove.mutate()}>
                    Eliminar
                  </SecondaryButton>
                ) : null}
              </div>

              <p className="mt-2 text-xs text-zinc-400">
                PNG, JPG o WEBP, hasta 2 MB. El servidor verifica el contenido real del archivo.
              </p>
            </>
          ) : null}

          {busy ? (
            <p className="mt-3 text-xs text-zinc-600">
              <Spinner className="size-3.5" label={upload.isPending ? "Subiendo archivo..." : "Eliminando..."} />
            </p>
          ) : null}

          {actionError ? (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
            >
              {describeError(actionError)}
            </p>
          ) : null}

          {loadError ? (
            <p className="mt-3 text-xs text-red-600">{loadError}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
