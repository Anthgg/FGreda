import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import {
  addProductionNote,
  cancelProductionOrder,
  completeProductionOrder,
  createProductionOrder,
  fetchProductionConsumptions,
  fetchProductionOrder,
  fetchProductionOrderByToken,
  fetchProductionOrders,
  fetchProductionTimeline,
  registerProductionCommunication,
  registerProductionConsumption,
  startProductionOrder,
} from "@/api/production";
import { MOVEMENTS_KEY, STOCK_KEY } from "@/features/masters/useMasters";
import { PROTOTYPES_KEY } from "@/features/prototypes/usePrototypes";
import { QUOTATIONS_KEY } from "@/features/quotations/useQuotations";
import type {
  ProductionCommunicationCreateIn,
  ProductionConsumptionCreateIn,
  ProductionNoteCreateIn,
  ProductionOrderCreateIn,
  ProductionOrderFilters,
} from "@/types/production";

export const PRODUCTION_KEY = ["production-orders"] as const;
export const productionOrderKey = (id: number) => [...PRODUCTION_KEY, id] as const;
/**
 * Fase 010I. Cuelgan de la clave de la orden a propósito: invalidar la orden
 * refresca también su seguimiento y sus consumos, y nada más.
 */
export const productionTimelineKey = (id: number) =>
  [...productionOrderKey(id), "timeline"] as const;
export const productionConsumptionsKey = (id: number) =>
  [...productionOrderKey(id), "consumptions"] as const;

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
 *
 * Y la MUESTRA, desde 009K.4. Arrancar una orden de prototipo escribe lo
 * realmente consumido en sus líneas, y completarla o anularla mueve su estado
 * físico. Sin esto, la ficha de la orden seguiría diciendo «Aún no consta»
 * junto a un material que acababa de salir del almacén: el dato correcto ya
 * estaba en el backend y la pantalla enseñaba el de antes.
 */
function useInvalidateAfterTransition() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: PRODUCTION_KEY });
    void qc.invalidateQueries({ queryKey: STOCK_KEY });
    void qc.invalidateQueries({ queryKey: MOVEMENTS_KEY });
    void qc.invalidateQueries({ queryKey: PROTOTYPES_KEY });
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

// ---------------------------------------------------------------------------
// Fase 010I — ejecución real de una orden V2
// ---------------------------------------------------------------------------

/**
 * La orden de una cotización V2, si existe. Mismo criterio que la Legacy: el
 * listado filtrado devuelve cero o una fila, porque la base impone una orden
 * por cotización. El filtro es PROPIO: el id de una V2 no es el de una Legacy.
 */
export const useProductionOrderForV2Quotation = (v2QuotationId: number | null) =>
  useQuery({
    queryKey: [...PRODUCTION_KEY, "for-v2-quotation", v2QuotationId],
    queryFn: () => fetchProductionOrders({ v2_quotation_id: v2QuotationId!, limit: 1 }),
    enabled: v2QuotationId !== null,
    select: (page) => page.items[0] ?? null,
  });

export const useProductionTimeline = (id: number | null) =>
  useQuery({
    queryKey: productionTimelineKey(id!),
    queryFn: () => fetchProductionTimeline(id!),
    enabled: id !== null,
  });

export const useProductionConsumptions = (id: number | null) =>
  useQuery({
    queryKey: productionConsumptionsKey(id!),
    queryFn: () => fetchProductionConsumptions(id!),
    enabled: id !== null,
  });

/**
 * Una clave de idempotencia por INTENCIÓN, no por petición.
 *
 * Se crea al abrir un formulario y se reutiliza en cada reintento de ESA
 * operación —un corte de red, un doble clic—, que es lo que impide al backend
 * registrarla dos veces. Sólo `renovar` crea otra: al terminar con éxito o al
 * volver a editar, cuando lo que se envíe ya será otra operación.
 */
export function useIdempotencyKey(): { key: string; renovar: () => void } {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const renovar = useCallback(() => setKey(crypto.randomUUID()), []);
  return { key, renovar };
}

/**
 * Registrar un consumo real. **Mueve inventario.**
 *
 * Sin actualización optimista: el saldo se lee del backend después. Se
 * invalida la orden (con su seguimiento y sus consumos) y el inventario; no la
 * lista de órdenes, que no cambia por un consumo.
 */
export const useRegisterConsumption = (orderId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductionConsumptionCreateIn) =>
      registerProductionConsumption(orderId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productionOrderKey(orderId) });
      void qc.invalidateQueries({ queryKey: MOVEMENTS_KEY });
    },
    // También si falla: con «no hay existencia» el saldo que se enseñaba ya no
    // es el que acaba de mirar el backend, y hay que volver a leerlo.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: STOCK_KEY });
    },
  });
};

/** Nota o quema. Sólo cambia el seguimiento. */
export const useAddProductionNote = (orderId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductionNoteCreateIn) => addProductionNote(orderId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productionTimelineKey(orderId) });
    },
  });
};

/** Registrar un aviso. Sólo cambia el seguimiento: ni estado ni inventario. */
export const useRegisterCommunication = (orderId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductionCommunicationCreateIn) =>
      registerProductionCommunication(orderId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: productionTimelineKey(orderId) });
    },
  });
};
