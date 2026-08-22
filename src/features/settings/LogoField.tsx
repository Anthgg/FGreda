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
 * Vista previa y gestion del logo.
 *
 * El binario se pide al backend con el cliente centralizado y se muestra desde
 * un object URL. Una etiqueta `img` apuntando directamente al backend no
 * enviaria las cookies en contexto cross-site, y en ningun caso se contacta con
 * Supabase Storage.
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
      // Sin revocar, cada recarga del logo dejaria un blob retenido en memoria.
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
    <section className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h3 className="flex items-baseline justify-between gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <span>Logo</span>
          <span className="font-normal normal-case text-zinc-400 dark:text-zinc-500">Opcional</span>
        </h3>

      <div className="mt-3 flex flex-wrap items-start gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          {isLoading ? (
            <Spinner className="size-4" />
          ) : previewUrl ? (
            <img src={previewUrl} alt="Logo de la empresa" className="max-h-full max-w-full" />
          ) : (
            <span className="px-2 text-center text-[11px] text-zinc-400 dark:text-zinc-600">
              Sin logo
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {logo ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {logo.content_type} · {(logo.size_bytes / 1024).toFixed(0)} KB
            </p>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Todavia no se ha cargado ningun logo.
            </p>
          )}

          {canEdit ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED}
                  disabled={busy}
                  aria-label="Seleccionar archivo de logo"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                  className="block w-full max-w-xs text-xs text-zinc-600 file:mr-2 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-50 disabled:opacity-60 dark:text-zinc-400 dark:file:border-zinc-700 dark:file:bg-zinc-900 dark:file:text-zinc-200"
                />
                {logo ? (
                  <SecondaryButton disabled={busy} onClick={() => remove.mutate()}>
                    Eliminar
                  </SecondaryButton>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                PNG, JPG o WEBP, hasta 2 MB. El servidor verifica el contenido real del archivo.
              </p>
            </>
          ) : null}

          {busy ? (
            <p className="mt-2 text-xs text-zinc-500">
              <Spinner className="size-3" label={upload.isPending ? "Subiendo..." : "Eliminando..."} />
            </p>
          ) : null}

          {actionError ? (
            <p
              role="alert"
              className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {describeError(actionError)}
            </p>
          ) : null}

          {loadError ? (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{loadError}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
