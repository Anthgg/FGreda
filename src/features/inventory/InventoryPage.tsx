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
  useLocations,
  useMovements,
  useStock,
} from "@/features/masters/useMasters";
import type { MovementType, StockBalance } from "@/types/masters";

const MOVEMENT_LABELS: Record<MovementType, string> = {
  INITIAL_IMPORT: "Carga inicial",
  ADJUSTMENT: "Ajuste",
  IN: "Entrada",
  OUT: "Salida",
  PREPARATION_OUT: "Consumo por preparación",
  PREPARATION_IN: "Alta de preparado",
  PROTOTYPE_OUT: "Consumo por prototipo",
};

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
  const isAdmin = capabilitiesFor(user?.role).ajustarInventario;

  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [adjusting, setAdjusting] = useState<StockBalance | null>(null);
  const [historyFor, setHistoryFor] = useState<StockBalance | null>(null);

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
                      {isAdmin ? (
                        <SecondaryButton onClick={() => setAdjusting(balance)}>
                          Ajustar
                        </SecondaryButton>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}

        {adjusting !== null && isAdmin ? (
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
