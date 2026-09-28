/**
 * Inventario: saldos por producto y ubicacion, con su historial.
 *
 * El numero de la tabla no es editable como una celda de Excel. Para cambiarlo
 * se declara un ajuste con motivo y el backend genera el movimiento que lo
 * respalda.
 */

import { useState } from "react";

import { PrimaryButton, SecondaryButton, SelectField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { capabilitiesFor } from "@/features/auth/capabilities";
import { useSession } from "@/features/auth/useSession";
import { describeError } from "@/features/settings/messages";
import {
  Badge,
  EmptyState,
  MasterHeader,
  Panel,
  SearchInput,
  TableWrapper,
  Td,
  Th,
  Toolbar,
} from "@/features/masters/MasterTable";
import {
  useCreateAdjustment,
  useCreateDelivery,
  useLocations,
  useMovements,
  useProductMaster,
  useStock,
} from "@/features/masters/useMasters";
import { esPositivo } from "@/features/production/decimales";
import type { MovementType, StockBalance } from "@/types/masters";

const MOVEMENT_LABELS: Record<MovementType, string> = {
  INITIAL_IMPORT: "Carga inicial",
  ADJUSTMENT: "Ajuste",
  IN: "Entrada",
  OUT: "Salida",
  PREPARATION_OUT: "Consumo por preparación",
  PREPARATION_IN: "Alta de preparado",
  PROTOTYPE_OUT: "Consumo por prototipo",
  PRODUCTION_OUT: "Consumo por producción",
  PRODUCTION_IN: "Producción terminada",
  DELIVERY_OUT: "Entrega al cliente",
};

function DeliveryForm({
  balance,
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  balance: StockBalance;
  saving: boolean;
  error: unknown;
  onSubmit: (quantity: string, reason: string) => void;
  onCancel: () => void;
}) {
  const product = useProductMaster(balance.product_id);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  return (
    <section aria-label="Registrar entrega" className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
      <h2 className="text-sm font-semibold text-zinc-900">Entrega de producto terminado</h2>
      {product.isPending ? <Spinner label="Verificando tipo de producto…" /> : product.isError ? (
        <p role="alert" className="mt-2 text-xs text-red-700">No se pudo comprobar el tipo de producto: {describeError(product.error)}</p>
      ) : product.data.product_type !== "FINISHED_PRODUCT" ? (
        <p role="status" className="mt-2 text-xs text-amber-900">Este producto es {product.data.product_type}; la entrega al cliente sólo aplica a producto terminado.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-zinc-700">{balance.product_name} · {balance.location_name} · disponible: <strong className="tabular-nums">{balance.quantity} {balance.uom_code ?? ""}</strong></p>
          <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); if (esPositivo(quantity)) onSubmit(quantity.trim(), reason.trim()); }}>
            <TextField label="Cantidad a entregar" requirement="required" value={quantity} onChange={setQuantity} inputMode="decimal" hint={`Debe ser mayor que cero. Disponible: ${balance.quantity} ${balance.uom_code ?? ""}.`} />
            <TextField label="Motivo" requirement="optional" value={reason} onChange={setReason} maxLength={240} />
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <PrimaryButton type="submit" disabled={saving || !esPositivo(quantity)}>{saving ? "Registrando…" : "Registrar entrega"}</PrimaryButton>
              <SecondaryButton type="button" onClick={onCancel} disabled={saving}>Cancelar</SecondaryButton>
            </div>
          </form>
          {error ? <p role="alert" className="mt-3 text-xs text-red-700">{describeError(error)}</p> : null}
        </>
      )}
      <p className="mt-2 text-[11px] text-zinc-600">La producción terminada permanece en stock hasta que se registre esta salida.</p>
      {product.isError || (product.data && product.data.product_type !== "FINISHED_PRODUCT") ? <SecondaryButton type="button" className="mt-3" onClick={onCancel}>Cerrar</SecondaryButton> : null}
    </section>
  );
}

function AdjustmentForm({
  balance,
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  balance: StockBalance;
  saving: boolean;
  error: unknown;
  onSubmit: (quantity: string, reason: string) => void;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  return (
    <form
      className="mt-4 rounded-xl border border-zinc-200 bg-white/70 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(quantity, reason);
      }}
    >
      <p className="mb-3 text-sm font-medium text-zinc-800">
        Ajustar {balance.product_name} en {balance.location_name}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextField
          label="Cantidad a sumar o restar"
          requirement="required"
          value={quantity}
          onChange={setQuantity}
          inputMode="decimal"
          hint="Con signo: -50 descuenta. No se escribe el saldo final."
        />
        <TextField
          label="Motivo"
          requirement="required"
          value={reason}
          onChange={setReason}
          maxLength={240}
          className="sm:col-span-2"
        />
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-600">
          {describeError(error)}
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <PrimaryButton
          type="submit"
          disabled={saving || quantity.trim() === "" || reason.trim().length < 3}
        >
          {saving ? "Registrando..." : "Registrar ajuste"}
        </PrimaryButton>
        <SecondaryButton onClick={onCancel} disabled={saving}>
          Cancelar
        </SecondaryButton>
      </div>
    </form>
  );
}

export function InventoryPage() {
  const { data: user } = useSession();
  // Fase 009J. Ajustar existencia es del taller; abrir un almacen, no.
  const puedeAjustar = capabilitiesFor(user?.role).ajustarInventario;

  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [adjusting, setAdjusting] = useState<StockBalance | null>(null);
  const [historyFor, setHistoryFor] = useState<StockBalance | null>(null);
  const [deliveryFor, setDeliveryFor] = useState<StockBalance | null>(null);
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);

  const locations = useLocations();
  const stock = useStock({
    ...(search.trim() !== "" ? { search: search.trim() } : {}),
    ...(locationId !== "" ? { location_id: Number(locationId) } : {}),
    limit: 100,
  });
  const movements = useMovements(
    historyFor ? { product_id: historyFor.product_id, limit: 50 } : {},
    historyFor !== null,
  );
  const adjustment = useCreateAdjustment();
  const delivery = useCreateDelivery();

  return (
    <div className="w-full space-y-5">
      <MasterHeader
        title={
          <TypewriterTitle
            text="Inventario."
            className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
          />
        }
        subtitle="Existencia por producto y ubicación. Cada cambio deja movimiento."
      />

      <Panel>
        <Toolbar>
          <SearchInput
            label="Buscar existencia"
            placeholder="Producto o referencia"
            value={search}
            onChange={setSearch}
          />
          <SelectField
            label="Ubicación"
            value={locationId}
            options={[
              { value: "", label: "Todas las ubicaciones" },
              ...(locations.data ?? []).map((item) => ({
                value: String(item.id),
                label: item.name,
              })),
            ]}
            onChange={setLocationId}
            className="w-full sm:w-64"
          />
        </Toolbar>

        {stock.isPending ? (
          <Spinner label="Cargando inventario..." />
        ) : stock.error ? (
          <p className="py-8 text-center text-sm text-red-600">
            {describeError(stock.error)}
          </p>
        ) : (stock.data?.items.length ?? 0) === 0 ? (
          <EmptyState message="Todavía no hay existencias registradas." />
        ) : (
          <TableWrapper>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Producto</Th>
                <Th>Ubicación</Th>
                <Th>Unidad</Th>
                <Th align="right">Stock actual</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {stock.data?.items.map((balance) => (
                <tr key={`${balance.product_id}-${balance.location_id}`}>
                  <Td mono>{balance.internal_reference}</Td>
                  <Td>{balance.product_name}</Td>
                  <Td muted>{balance.location_name}</Td>
                  <Td muted>{balance.uom_code ?? "—"}</Td>
                  <Td align="right" mono>
                    {balance.quantity}
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <SecondaryButton
                        onClick={() =>
                          setHistoryFor(
                            historyFor?.product_id === balance.product_id ? null : balance,
                          )
                        }
                      >
                        Historial
                      </SecondaryButton>
                      {puedeAjustar ? (
                        <SecondaryButton onClick={() => setAdjusting(balance)}>
                          Ajustar
                        </SecondaryButton>
                      ) : null}
                      <SecondaryButton onClick={() => { setDeliveryNotice(null); setDeliveryFor((current) => current?.product_id === balance.product_id && current.location_id === balance.location_id ? null : balance); }}>
                        {deliveryFor?.product_id === balance.product_id && deliveryFor.location_id === balance.location_id ? "Cerrar entrega" : "Entrega…"}
                      </SecondaryButton>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}

        {adjusting !== null && puedeAjustar ? (
          <AdjustmentForm
            balance={adjusting}
            saving={adjustment.isPending}
            error={adjustment.error}
            onSubmit={(quantity, reason) =>
              adjustment.mutate(
                {
                  product_id: adjusting.product_id,
                  location_id: adjusting.location_id,
                  quantity,
                  reason,
                },
                { onSuccess: () => setAdjusting(null) },
              )
            }
            onCancel={() => setAdjusting(null)}
          />
        ) : null}

        {deliveryNotice ? <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">{deliveryNotice}</p> : null}
        {deliveryFor !== null ? (
          <DeliveryForm
            key={`${deliveryFor.product_id}-${deliveryFor.location_id}`}
            balance={deliveryFor}
            saving={delivery.isPending}
            error={delivery.error}
            onCancel={() => setDeliveryFor(null)}
            onSubmit={(quantity, reason) => delivery.mutate({
              product_id: deliveryFor.product_id,
              location_id: deliveryFor.location_id,
              quantity,
              ...(reason ? { reason } : {}),
            }, {
              onSuccess: () => {
                setDeliveryNotice(`Entrega registrada: ${quantity} ${deliveryFor.uom_code ?? ""} de ${deliveryFor.product_name}. Producción completada y entrega son movimientos separados.`);
                setDeliveryFor(null);
              },
            })}
          />
        ) : null}

        {historyFor !== null ? (
          <section className="mt-6 border-t border-zinc-200 pt-4">
            <h2 className="mb-3 text-sm font-semibold text-zinc-800">
              Movimientos de {historyFor.product_name}
            </h2>
            {movements.isPending ? (
              <Spinner label="Cargando movimientos..." />
            ) : (movements.data?.items.length ?? 0) === 0 ? (
              <EmptyState message="Sin movimientos registrados." />
            ) : (
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>Fecha</Th>
                    <Th>Tipo</Th>
                    <Th>Ubicación</Th>
                    <Th align="right">Cantidad</Th>
                    <Th align="right">Saldo</Th>
                    <Th>Motivo</Th>
                    <Th>Responsable</Th>
                  </tr>
                </thead>
                <tbody>
                  {movements.data?.items.map((movement) => (
                    <tr key={movement.id}>
                      <Td muted>{new Date(movement.created_at).toLocaleString()}</Td>
                      <Td>
                        <Badge
                          tone={movement.movement_type === "INITIAL_IMPORT" ? "neutral" : "warning"}
                        >
                          {MOVEMENT_LABELS[movement.movement_type]}
                        </Badge>
                      </Td>
                      <Td muted>{movement.location_name}</Td>
                      <Td align="right" mono>
                        {movement.quantity}
                      </Td>
                      <Td align="right" mono>
                        {movement.balance_after}
                      </Td>
                      <Td muted>{movement.reason ?? "—"}</Td>
                      <Td muted>{movement.created_by_name ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </section>
        ) : null}
      </Panel>
    </div>
  );
}
