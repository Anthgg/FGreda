import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelProductionOrder,
  completeProductionOrder,
  createProductionOrder,
  fetchProductionOrder,
  fetchProductionOrderByToken,
  fetchProductionOrders,
  startProductionOrder,
} from "@/api/production";
import { MOVEMENTS_KEY, STOCK_KEY } from "@/features/masters/useMasters";
import { QUOTATIONS_KEY } from "@/features/quotations/useQuotations";
import type { ProductionOrderCreateIn, ProductionOrderFilters } from "@/types/production";

export const PRODUCTION_KEY = ["production-orders"] as const;
export const productionOrderKey = (id: number) => [...PRODUCTION_KEY, id] as const;

export const useProductionOrders = (filters: ProductionOrderFilters) =>
  useQuery({
    queryKey: [...PRODUCTION_KEY, filters],
    queryFn: () => fetchProductionOrders(filters),
  });

export const useProductionOrder = (id: number | null) =>
  useQuery({
    queryKey: productionOrderKey(id!),
    queryFn: () => fetchProductionOrder(id!),
    enabled: id !== null,
  });

export const useProductionOrderByToken = (token: string | null) =>
  useQuery({
    queryKey: [...PRODUCTION_KEY, "scan", token],
    queryFn: () => fetchProductionOrderByToken(token!),
    enabled: token !== null && token !== "",
    retry: false,
  });

/**
 * La orden de una cotización, si existe.
 *
 * Se pregunta por el listado filtrado y no por una ruta propia: una cotización
 * tiene como mucho una orden, así que el filtro devuelve cero o una fila.
 */
export const useProductionOrderForQuotation = (quotationId: number | null) =>
  useQuery({
    queryKey: [...PRODUCTION_KEY, "for-quotation", quotationId],
    queryFn: () => fetchProductionOrders({ quotation: quotationId!, limit: 1 }),
    enabled: quotationId !== null,
    select: (page) => page.items[0] ?? null,
  });

/**
 * Invalida lo que una transición puede haber cambiado.
 *
 * Se invalida también el inventario porque arrancar descuenta material: dejar
 * los saldos en caché haría que la pantalla de stock siguiera mostrando un
 * barniz que ya se gastó.
 */
function useInvalidateAfterTransition() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: PRODUCTION_KEY });
    void qc.invalidateQueries({ queryKey: STOCK_KEY });
    void qc.invalidateQueries({ queryKey: MOVEMENTS_KEY });
  };
}

export const useCreateProductionOrder = () => {
  const qc = useQueryClient();
  const invalidate = useInvalidateAfterTransition();
  return useMutation({
    mutationFn: (payload: ProductionOrderCreateIn) => createProductionOrder(payload),
    onSuccess: () => {
      invalidate();
      // La cotización no cambia, pero la pantalla que la muestra ofrece ahora
      // «Ver orden» en vez de «Crear orden».
      void qc.invalidateQueries({ queryKey: QUOTATIONS_KEY });
    },
  });
};

/** Arrancar. La única mutación del módulo que mueve inventario. */
export const useStartProductionOrder = () => {
  const invalidate = useInvalidateAfterTransition();
  return useMutation({
    mutationFn: (id: number) => startProductionOrder(id),
    // También en el fallo: cuando el arranque se rechaza por falta de stock, la
    // disponibilidad que hay en pantalla ya no es la que acaba de mirar el
    // backend, y dejarla ahi haria creer que el boton falla sin motivo.
    onSettled: invalidate,
  });
};

export const useCompleteProductionOrder = () => {
  const invalidate = useInvalidateAfterTransition();
  return useMutation({
    mutationFn: (id: number) => completeProductionOrder(id),
    onSuccess: invalidate,
  });
};

export const useCancelProductionOrder = () => {
  const invalidate = useInvalidateAfterTransition();
  return useMutation({
    mutationFn: (id: number) => cancelProductionOrder(id),
    onSuccess: invalidate,
  });
};
