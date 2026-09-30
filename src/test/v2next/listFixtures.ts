import type { V2QuotationListItem, V2QuotationPage } from "@/types/quoterV2";

export const mockQuotationListItem = (
  overrides?: Partial<V2QuotationListItem>
): V2QuotationListItem => ({
  id: 1,
  code: "V2-0001",
  pricing_engine_version: "V2",
  status: "DRAFT",
  production_type: "RETAIL",
  customer_name: "Test Customer",
  name: "Test Project",
  created_at: "2024-03-01T10:00:00Z",
  effective_status: "DRAFT",
  valid_until: null,
  ...overrides,
});

export const mockQuotationPage = (
  items: V2QuotationListItem[] = [mockQuotationListItem()],
  total?: number
): V2QuotationPage => ({
  items,
  total: total ?? items.length,
});
