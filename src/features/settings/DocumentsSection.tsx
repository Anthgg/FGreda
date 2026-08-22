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
      { onSuccess: (data) => commit(toCommercialInput(data)) },
    );
  };

  const disabled = !canEdit || update.isPending;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-6">
        <FormSection
          title="Textos de Documentos"
          description="Se almacenan y se muestran como texto plano. No se admite HTML."
          className="space-y-6"
        >
          <TextAreaField
            label="Condiciones generales"
            requirement="optional"
            value={draft.general_conditions}
            onChange={(value) => setField("general_conditions", value)}
            disabled={disabled}
            rows={4}
            className="w-full"
          />
          <TextAreaField
            label="Notas de pago"
            requirement="optional"
            value={draft.payment_notes}
            onChange={(value) => setField("payment_notes", value)}
            disabled={disabled}
            rows={3}
            className="w-full"
          />
          <TextAreaField
            label="Pie de documento"
            requirement="optional"
            value={draft.document_footer}
            onChange={(value) => setField("document_footer", value)}
            disabled={disabled}
            rows={3}
            className="w-full"
          />
        </FormSection>

        <p className="text-xs text-zinc-400 italic">
          Estos textos se usarán en los documentos que generen las fases siguientes. La Fase 2 no genera PDF todavía.
        </p>
      </div>

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
