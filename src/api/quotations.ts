import { apiClient } from "@/api/client";
import { toQuery } from "@/api/masters";
import type {
  AdditionalInput,
  AdditionalOut,
  MasterPage,
  OtherCostInput,
  OtherCostOut,
  ProductPriceUpdateOut,
  QuotationCalculateIn,
  QuotationCalculateOut,
  QuotationFilters,
  QuotationOut,
  QuotationPage,
  TechniqueInput,
  TechniqueOut,
  QuotationTotalsOut,
} from "@/types/quotations";

const QUOTATIONS = "/quotations";

export const fetchTechniques = (active?: boolean): Promise<MasterPage<TechniqueOut>> =>
  apiClient.get(`/techniques${toQuery({ active, limit: 200 })}`);
export const createTechnique = (payload: TechniqueInput): Promise<TechniqueOut> =>
  apiClient.post("/techniques", payload);
export const updateTechnique = (id: number, payload: TechniqueInput): Promise<TechniqueOut> =>
  apiClient.put(`/techniques/${id}`, payload);

export const fetchAdditionals = (active?: boolean): Promise<MasterPage<AdditionalOut>> =>
  apiClient.get(`/additionals${toQuery({ active, limit: 200 })}`);
export const createAdditional = (payload: AdditionalInput): Promise<AdditionalOut> =>
  apiClient.post("/additionals", payload);
export const updateAdditional = (id: number, payload: AdditionalInput): Promise<AdditionalOut> =>
  apiClient.put(`/additionals/${id}`, payload);

export const fetchOtherCosts = (active?: boolean): Promise<MasterPage<OtherCostOut>> =>
  apiClient.get(`/other-costs${toQuery({ active, limit: 200 })}`);
export const createOtherCost = (payload: OtherCostInput): Promise<OtherCostOut> =>
  apiClient.post("/other-costs", payload);
export const updateOtherCost = (id: number, payload: OtherCostInput): Promise<OtherCostOut> =>
  apiClient.put(`/other-costs/${id}`, payload);

export const calculateQuotation = (
  payload: QuotationCalculateIn,
): Promise<QuotationCalculateOut> =>
  apiClient.post(`${QUOTATIONS}/calculate`, payload);
export const fetchQuotations = (filters: QuotationFilters): Promise<QuotationPage> =>
  apiClient.get(QUOTATIONS + toQuery(filters as Record<string, unknown>));
/** Totales por moneda. El backend es la autoridad de la agregacion. */
export const fetchQuotationTotals = (
  filters: QuotationFilters,
): Promise<QuotationTotalsOut> =>
  apiClient.get(`${QUOTATIONS}/totals` + toQuery(filters as Record<string, unknown>));
export const fetchQuotation = (id: number): Promise<QuotationOut> =>
  apiClient.get(`${QUOTATIONS}/${id}`);
export const createQuotation = (payload: QuotationCalculateIn): Promise<QuotationOut> =>
  apiClient.post(QUOTATIONS, payload);
export const updateQuotation = (
  id: number,
  payload: QuotationCalculateIn & {
    expected_source_fingerprint: string;
    accept_source_changes: boolean;
  },
): Promise<QuotationOut> => apiClient.put(`${QUOTATIONS}/${id}`, payload);
export const confirmQuotation = (id: number, acceptSourceChanges = false): Promise<QuotationOut> =>
  apiClient.post(`${QUOTATIONS}/${id}/confirm`, {
    accept_source_changes: acceptSourceChanges,
  });
export const cancelQuotation = (id: number): Promise<QuotationOut> =>
  apiClient.post(`${QUOTATIONS}/${id}/cancel`, {});
export const duplicateQuotation = (id: number): Promise<QuotationOut> =>
  apiClient.post(`${QUOTATIONS}/${id}/duplicate`, {});
export const updateQuotationProductPrice = (id: number): Promise<ProductPriceUpdateOut> =>
  apiClient.post(`${QUOTATIONS}/${id}/update-product-price`, {});
export const fetchQuotationPdf = (
  id: number,
): Promise<{ blob: Blob; filename: string | null }> =>
  apiClient.getBlobWithFilename(`${QUOTATIONS}/${id}/pdf`);
