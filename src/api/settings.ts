/**
 * Operaciones de configuracion contra BGreda.
 *
 * Ninguna funcion de este modulo decide permisos ni calcula valores oficiales:
 * el backend valida todo de nuevo y es quien acepta o rechaza.
 */

import { apiClient } from "@/api/client";
import type {
  AuditPage,
  CommercialSettings,
  CommercialSettingsInput,
  CompanySettings,
  CompanySettingsInput,
  ReferenceData,
  SequenceConfig,
  SequenceConfigInput,
  SequenceList,
  SequencePatternPreset,
  SequencePatternPresetInput,
  SequenceType,
} from "@/types/settings";

const COMPANY = "/settings/company";
const LOGO = "/settings/company/logo";
const COMMERCIAL = "/settings/commercial";
const SEQUENCES = "/settings/sequences";
const REFERENCE_DATA = "/settings/reference-data";
const SEQUENCE_PATTERNS = "/settings/sequence-patterns";
const AUDIT = "/settings/audit";

// ---------------------------------------------------------------------------
// Empresa
// ---------------------------------------------------------------------------
export function fetchCompanySettings(): Promise<CompanySettings> {
  return apiClient.get<CompanySettings>(COMPANY);
}

export function updateCompanySettings(payload: CompanySettingsInput): Promise<CompanySettings> {
  return apiClient.put<CompanySettings>(COMPANY, payload);
}

/** Descarga el logo por el backend. El navegador nunca llama a Storage. */
export function fetchLogoBlob(): Promise<Blob> {
  return apiClient.getBlob(LOGO);
}

export function uploadLogo(file: File): Promise<CompanySettings> {
  const form = new FormData();
  form.append("file", file);
  return apiClient.postForm<CompanySettings>(LOGO, form, { timeoutMs: 60_000 });
}

export function deleteLogo(): Promise<CompanySettings> {
  return apiClient.delete<CompanySettings>(LOGO);
}

// ---------------------------------------------------------------------------
// Catalogos controlados
// ---------------------------------------------------------------------------
export function fetchReferenceData(): Promise<ReferenceData> {
  return apiClient.get<ReferenceData>(REFERENCE_DATA);
}

export function createSequencePattern(
  payload: SequencePatternPresetInput,
): Promise<SequencePatternPreset> {
  return apiClient.post<SequencePatternPreset>(SEQUENCE_PATTERNS, payload);
}

// ---------------------------------------------------------------------------
// Comercial
// ---------------------------------------------------------------------------
export function fetchCommercialSettings(): Promise<CommercialSettings> {
  return apiClient.get<CommercialSettings>(COMMERCIAL);
}

export function updateCommercialSettings(
  payload: CommercialSettingsInput,
): Promise<CommercialSettings> {
  return apiClient.put<CommercialSettings>(COMMERCIAL, payload);
}

// ---------------------------------------------------------------------------
// Secuencias
// ---------------------------------------------------------------------------
export async function fetchSequences(): Promise<SequenceConfig[]> {
  const response = await apiClient.get<SequenceList>(SEQUENCES);
  return response.sequences;
}

export function updateSequence(
  sequenceType: SequenceType,
  payload: SequenceConfigInput,
): Promise<SequenceConfig> {
  return apiClient.put<SequenceConfig>(`${SEQUENCES}/${sequenceType}`, payload);
}

// ---------------------------------------------------------------------------
// Historial
// ---------------------------------------------------------------------------
export function fetchAuditEvents(limit = 50): Promise<AuditPage> {
  return apiClient.get<AuditPage>(`${AUDIT}?limit=${limit}`);
}
