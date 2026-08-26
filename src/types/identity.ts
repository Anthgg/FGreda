/**
 * Contratos de la consulta de identidad (DNI/RUC).
 *
 * Reflejan exactamente `app/schemas/identity.py` en BGreda: ningun campo se
 * inventa aqui que el backend no entregue.
 */

export interface DniLookupResult {
  document_type: "DNI";
  document_number: string;
  full_name: string;
  first_names: string | null;
  paternal_surname: string | null;
  maternal_surname: string | null;
  provider: string;
  cache_hit: boolean;
  freshness: string;
}

export interface RucLookupResult {
  document_type: "RUC";
  document_number: string;
  business_name: string;
  status: string | null;
  condition: string | null;
  address: string | null;
  ubigeo: string | null;
  department: string | null;
  province: string | null;
  district: string | null;
  provider: string;
  cache_hit: boolean;
  freshness: string;
}
