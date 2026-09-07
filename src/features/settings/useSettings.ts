/**
 * Estado de la configuracion sobre TanStack Query.
 *
 * No se duplica el estado del servidor en ningun almacen global: la cache de
 * la query es la unica copia, y las mutaciones la invalidan.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createSequencePattern,
  createUser,
  deleteLogo,
  fetchAuditEvents,
  fetchCommercialSettings,
  fetchCompanySettings,
  fetchReferenceData,
  fetchSequences,
  fetchUsers,
  setUserActive,
  updateCommercialSettings,
  updateCompanySettings,
  updateSequence,
  updateUser,
  uploadLogo,
} from "@/api/settings";
import type {
  CommercialSettingsInput,
  CompanySettingsInput,
  SequencePatternPresetInput,
  SequenceConfigInput,
  SequenceType,
  UserCreateInput,
  UserUpdateInput,
} from "@/types/settings";

export const COMPANY_KEY = ["settings", "company"] as const;
export const COMMERCIAL_KEY = ["settings", "commercial"] as const;
export const SEQUENCES_KEY = ["settings", "sequences"] as const;
export const AUDIT_KEY = ["settings", "audit"] as const;
export const REFERENCE_DATA_KEY = ["settings", "reference-data"] as const;

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
export function useCompanySettings() {
  return useQuery({ queryKey: COMPANY_KEY, queryFn: fetchCompanySettings });
}

export function useReferenceData() {
  return useQuery({ queryKey: REFERENCE_DATA_KEY, queryFn: fetchReferenceData });
}

export function useCommercialSettings() {
  return useQuery({ queryKey: COMMERCIAL_KEY, queryFn: fetchCommercialSettings });
}

export function useSequences() {
  return useQuery({ queryKey: SEQUENCES_KEY, queryFn: fetchSequences });
}

export function useAuditEvents(enabled: boolean) {
  return useQuery({ queryKey: AUDIT_KEY, queryFn: () => fetchAuditEvents(), enabled });
}

// ---------------------------------------------------------------------------
// Mutaciones
// ---------------------------------------------------------------------------
export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CompanySettingsInput) => updateCompanySettings(payload),
    onSuccess: (data) => {
      // El backend devuelve el estado resultante, incluida la nueva version:
      // se guarda tal cual para que el siguiente guardado no de conflicto.
      queryClient.setQueryData(COMPANY_KEY, data);
      void queryClient.invalidateQueries({ queryKey: AUDIT_KEY });
    },
  });
}

export function useUpdateCommercial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CommercialSettingsInput) => updateCommercialSettings(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(COMMERCIAL_KEY, data);
      void queryClient.invalidateQueries({ queryKey: AUDIT_KEY });
    },
  });
}

export function useUpdateSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sequenceType,
      payload,
    }: {
      sequenceType: SequenceType;
      payload: SequenceConfigInput;
    }) => updateSequence(sequenceType, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SEQUENCES_KEY });
      void queryClient.invalidateQueries({ queryKey: AUDIT_KEY });
    },
  });
}

export function useCreateSequencePattern() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SequencePatternPresetInput) => createSequencePattern(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REFERENCE_DATA_KEY });
      void queryClient.invalidateQueries({ queryKey: AUDIT_KEY });
    },
  });
}

export function useUploadLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadLogo(file),
    onSuccess: (data) => {
      queryClient.setQueryData(COMPANY_KEY, data);
      void queryClient.invalidateQueries({ queryKey: AUDIT_KEY });
    },
  });
}

export function useDeleteLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLogo,
    onSuccess: (data) => {
      queryClient.setQueryData(COMPANY_KEY, data);
      void queryClient.invalidateQueries({ queryKey: AUDIT_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// Usuarios (Fase 009K.2)
//
// Toda mutacion invalida la lista Y el historial: administrar usuarios queda
// auditado, y el Historial de Configuracion es donde se lee.
// ---------------------------------------------------------------------------
export const USERS_KEY = ["settings", "users"] as const;

export function useUsers(enabled: boolean) {
  return useQuery({ queryKey: USERS_KEY, queryFn: fetchUsers, enabled });
}

function useUserMutation<TArgs>(mutationFn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      void queryClient.invalidateQueries({ queryKey: AUDIT_KEY });
    },
  });
}

export function useCreateUser() {
  return useUserMutation((payload: UserCreateInput) => createUser(payload));
}

export function useUpdateUser() {
  return useUserMutation(({ id, payload }: { id: string; payload: UserUpdateInput }) =>
    updateUser(id, payload),
  );
}

/** Baja y alta de nuevo. No existe borrado. */
export function useSetUserActive() {
  return useUserMutation(({ id, active }: { id: string; active: boolean }) =>
    setUserActive(id, active),
  );
}
