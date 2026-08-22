import { useMemo } from "react";
import type { FormEvent } from "react";

import { FormSection, TextAreaField } from "@/components/form";
import { toCommercialInput } from "@/features/settings/mappers";
import { SaveBar } from "@/features/settings/SaveBar";
import { useEditableForm } from "@/features/settings/useEditableForm";
import { useCommercialSettings, useUpdateCommercial } from "@/features/settings/useSettings";
import type { CommercialSettingsInput } from "@/types/settings";

/**
 * Textos por defecto de los documentos.
 *
 * Comparten almacenamiento con los parametros comerciales, pero se editan
 * aparte porque son un trabajo distinto: aqui se redacta, alli se configura.
 */
export function DocumentsSection({ canEdit }: { canEdit: boolean }) {
  const query = useCommercialSettings();
  const update = useUpdateCommercial();
  const inicial = useMemo(
    () => (query.data ? toCommercialInput(query.data) : undefined),
    [query.data],
  );
  const { draft, setField, reset, commit, isDirty } = useEditableForm<CommercialSettingsInput>(
    inicial,
  );

  if (!draft) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty || update.isPending) return;
    update.mutate(
      { ...draft, version: query.data?.version ?? draft.version },
      // Se adopta la respuesta del servidor: deja el formulario limpio y
      // la siguiente escritura parte de la version ya confirmada.
      { onSuccess: (data) => commit(toCommercialInput(data)) },
    );
  };

  const disabled = !canEdit || update.isPending;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormSection
        title="Textos de documentos"
        description="Se almacenan y se muestran como texto plano. No se admite HTML."
      >
        <TextAreaField
          label="Condiciones generales"
          requirement="optional"
          value={draft.general_conditions}
          onChange={(value) => setField("general_conditions", value)}
          disabled={disabled}
          rows={5}
          className="sm:col-span-2"
        />
        <TextAreaField
          label="Notas de pago"
          requirement="optional"
          value={draft.payment_notes}
          onChange={(value) => setField("payment_notes", value)}
          disabled={disabled}
          rows={3}
          className="sm:col-span-2"
        />
        <TextAreaField
          label="Pie de documento"
          requirement="optional"
          value={draft.document_footer}
          onChange={(value) => setField("document_footer", value)}
          disabled={disabled}
          rows={2}
          className="sm:col-span-2"
        />
      </FormSection>

      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        Estos textos se usaran en los documentos que generen las fases siguientes. La Fase 2 no
        genera PDF todavia.
      </p>

      <SaveBar
        canEdit={canEdit}
        isDirty={isDirty}
        isSaving={update.isPending}
        isSuccess={update.isSuccess && !isDirty}
        error={update.error}
        onCancel={reset}
        onReload={() => void query.refetch()}
      />
    </form>
  );
}
