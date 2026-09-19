import { useEffect, useMemo, useState } from "react";

import { interpretarDecimal } from "@/components/decimal";
import { PrimaryButton, SecondaryButton, TextAreaField, TextField } from "@/components/form";
import { SelectField } from "@/components/SelectField";
import { useDialogoAccesible } from "@/features/cotizadorV2/useDialogoAccesible";
import { useLocations, useStock } from "@/features/masters/useMasters";
import { esNegativo, esPositivo, normalizar, restar } from "@/features/production/decimales";
import {
  describeConsumptionKind,
  describeProductionError,
} from "@/features/production/mensajesProduccion";
import {
  useIdempotencyKey,
  useRegisterConsumption,
} from "@/features/production/useProductionOrders";
import type {
  ProductionConsumption,
  ProductionConsumptionKind,
  ProductionOrder,
  V2ProductionPiece,
} from "@/types/production";

const ORDEN_ENTERA = "ORDEN";

const CLASES: readonly { value: ProductionConsumptionKind; label: string }[] = [
  { value: "BODY", label: describeConsumptionKind("BODY") },
  { value: "GLAZE", label: describeConsumptionKind("GLAZE") },
  { value: "OTHER", label: describeConsumptionKind("OTHER") },
];

/**
 * El material que la cotización PLANIFICÓ para esa clase: el de la pieza
 * elegida o, si es de toda la orden, el que comparten todas. Es sólo una
 * sugerencia para empezar: el taller puede usar otro, y eso es un consumo
 * real válido.
 */
function materialPlanificado(
  piezas: readonly V2ProductionPiece[],
  kind: ProductionConsumptionKind,
  pieceId: string,
): number | null {
  const elegidas =
    pieceId === ORDEN_ENTERA ? piezas : piezas.filter((pieza) => String(pieza.id) === pieceId);
  const ids = new Set(
    elegidas
      .map((pieza) =>
        kind === "BODY"
          ? pieza.body_material_id
          : kind === "GLAZE" && pieza.requires_glaze
            ? pieza.glaze_material_id
            : null,
      )
      .filter((id): id is number => id !== null),
  );
  return ids.size === 1 ? [...ids][0]! : null;
}

interface Props {
  order: ProductionOrder;
  onClose: () => void;
  onRegistered: (consumo: ProductionConsumption) => void;
}

/**
 * Registrar un consumo REAL. Dos pasos y ningún autoguardado.
 *
 * Rellenar el formulario no toca nada. Sólo «Confirmar consumo», después de
 * ver material, almacén, cantidad y cómo queda el saldo, manda la petición.
 *
 * La clave de idempotencia es de la INTENCIÓN. Un reintento de ese mismo
 * consumo —un corte de red, un segundo clic en «Confirmar»— reutiliza la misma,
 * y el backend no descuenta dos veces. «Volver a editar» la renueva, porque lo
 * que se mande después ya será otro consumo.
 */
export function DialogoConsumo({ order, onClose, onRegistered }: Props) {
  const piezas = useMemo(() => order.v2_pieces ?? [], [order.v2_pieces]);
  const registrar = useRegisterConsumption(order.id);
  const { key, renovar } = useIdempotencyKey();
  const locations = useLocations();

  const [paso, setPaso] = useState<"editar" | "confirmar">("editar");
  const [kind, setKind] = useState<ProductionConsumptionKind>(
    order.pending_consumption_kinds?.[0] ?? "BODY",
  );
  const [pieceId, setPieceId] = useState<string>(ORDEN_ENTERA);
  const [locationId, setLocationId] = useState<string>(String(order.stock_location_id));
  const [productId, setProductId] = useState<string>("");
  const [elegidoAMano, setElegidoAMano] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");

  const stock = useStock({ location_id: Number(locationId), limit: 200 }, locationId !== "");
  const saldos = useMemo(() => stock.data?.items ?? [], [stock.data?.items]);

  // Mientras la persona no haya elegido material a mano, se propone el
  // planificado para la clase y la pieza. En cuanto elige uno, se respeta.
  useEffect(() => {
    if (elegidoAMano) return;
    const planificado = materialPlanificado(piezas, kind, pieceId);
    setProductId(planificado !== null ? String(planificado) : "");
  }, [piezas, kind, pieceId, elegidoAMano]);

  const contenedor = useDialogoAccesible<HTMLDivElement>(true);
  useEffect(() => {
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !registrar.isPending) onClose();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [onClose, registrar.isPending]);

  const planificados = new Map<number, string>();
  for (const pieza of piezas) {
    if (pieza.body_material_id !== null && pieza.body_material_name) {
      planificados.set(pieza.body_material_id, pieza.body_material_name);
    }
    if (pieza.requires_glaze && pieza.glaze_material_id !== null && pieza.glaze_material_name) {
      planificados.set(pieza.glaze_material_id, pieza.glaze_material_name);
    }
  }
  const opcionesMaterial = [
    ...saldos.map((saldo) => ({
      value: String(saldo.product_id),
      label: `${saldo.product_name} · saldo ${normalizar(saldo.quantity)} ${saldo.uom_code ?? ""}`.trim(),
    })),
    // Lo planificado sin existencia en este almacén también se ofrece, dicho
    // claramente: así se entiende por qué no alcanza, en vez de no aparecer.
    ...[...planificados]
      .filter(([id]) => !saldos.some((saldo) => saldo.product_id === id))
      .map(([id, nombre]) => ({
        value: String(id),
        label: `${nombre} · sin existencia en este almacén`,
      })),
  ];

  const saldo = saldos.find((fila) => String(fila.product_id) === productId) ?? null;
  const saldoActual = saldo?.quantity ?? "0";
  const unidad =
    saldo?.uom_code ??
    piezas.find((pieza) => String(pieza.body_material_id) === productId)?.body_uom ??
    "";
  const nombreMaterial =
    saldo?.product_name ?? planificados.get(Number(productId)) ?? "Material";
  const nombreAlmacen =
    (locations.data ?? []).find((location) => String(location.id) === locationId)?.name ??
    order.stock_location_name;
  const pieza = piezas.find((fila) => String(fila.id) === pieceId) ?? null;

  const cantidadInterpretada = interpretarDecimal(cantidad);
  const cantidadCanonica =
    cantidadInterpretada.tipo === "valido" ? cantidadInterpretada.canonico : null;
  const errorCantidad =
    cantidadInterpretada.tipo === "invalido"
      ? cantidadInterpretada.motivo
      : cantidadCanonica !== null && !esPositivo(cantidadCanonica)
        ? "La cantidad debe ser mayor que cero."
        : undefined;
  const saldoDespues = cantidadCanonica ? restar(saldoActual, cantidadCanonica) : null;
  const noAlcanza = saldoDespues !== null && esNegativo(saldoDespues);

  const listoParaConfirmar =
    productId !== "" &&
    locationId !== "" &&
    cantidadCanonica !== null &&
    esPositivo(cantidadCanonica);

  const volverAEditar = () => {
    registrar.reset();
    renovar();
    setPaso("editar");
  };

  const confirmar = () => {
    // El botón ya se desactiva mientras envía; esto cubre el doble clic que
    // llega antes de que React vuelva a pintar.
    if (registrar.isPending || !cantidadCanonica) return;
    registrar.mutate(
      {
        product_id: Number(productId),
        stock_location_id: Number(locationId),
        quantity: cantidadCanonica,
        kind,
        ...(pieceId !== ORDEN_ENTERA ? { v2_quotation_product_id: Number(pieceId) } : {}),
        ...(nota.trim() ? { note: nota.trim() } : {}),
        idempotency_key: key,
      },
      {
        onSuccess: (consumo) => {
          renovar();
          onRegistered(consumo);
        },
      },
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialogo-consumo-titulo"
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 sm:items-center sm:p-4"
    >
      <div
        ref={contenedor}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <h2 id="dialogo-consumo-titulo" className="text-base font-bold text-zinc-950">
          Registrar consumo real
        </h2>
        <p className="mt-1 text-xs text-zinc-600">
          El material que salió de verdad del almacén. Puede no ser el planificado.
        </p>

        {paso === "editar" ? (
          <div className="mt-4 space-y-3">
            <SelectField
              label="Clase de material"
              requirement="required"
              value={kind}
              options={CLASES}
              searchable={false}
              onChange={(valor) => setKind(valor)}
            />
            <SelectField
              label="Pieza"
              requirement="required"
              value={pieceId}
              searchable={false}
              options={[
                { value: ORDEN_ENTERA, label: "Toda la orden" },
                ...piezas.map((fila) => ({
                  value: String(fila.id),
                  label: `${fila.quantity} × ${fila.product_name}`,
                })),
              ]}
              onChange={setPieceId}
            />
            <SelectField
              label="Almacén"
              requirement="required"
              value={locationId}
              searchable={false}
              options={(locations.data ?? [])
                .filter((location) => location.active || String(location.id) === locationId)
                .map((location) => ({ value: String(location.id), label: location.name }))}
              onChange={(valor) => {
                setLocationId(valor);
                setElegidoAMano(false);
              }}
            />
            <SelectField
              label="Material"
              requirement="required"
              value={productId}
              options={opcionesMaterial}
              placeholder={stock.isPending ? "Cargando existencias…" : "Elija el material"}
              onChange={(valor) => {
                setProductId(valor);
                setElegidoAMano(true);
              }}
              hint={
                materialPlanificado(piezas, kind, pieceId) !== null && !elegidoAMano
                  ? "Propuesto el material planificado. Puede elegir otro."
                  : undefined
              }
            />
            <TextField
              label={`Cantidad${unidad ? ` (${unidad})` : ""}`}
              requirement="required"
              value={cantidad}
              inputMode="decimal"
              onChange={setCantidad}
              error={errorCantidad}
              hint="En la unidad del saldo del material."
            />
            <TextAreaField
              label="Nota"
              requirement="optional"
              value={nota}
              rows={2}
              onChange={setNota}
            />
            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
              <PrimaryButton
                type="button"
                disabled={!listoParaConfirmar}
                onClick={() => setPaso("confirmar")}
              >
                Revisar consumo
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3" data-testid="consumo-confirmacion">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm">
              <dt className="text-zinc-500">Material</dt>
              <dd className="font-medium text-zinc-900">{nombreMaterial}</dd>
              <dt className="text-zinc-500">Clase</dt>
              <dd className="text-zinc-900">{describeConsumptionKind(kind)}</dd>
              <dt className="text-zinc-500">Pieza</dt>
              <dd className="text-zinc-900">
                {pieza ? `${pieza.quantity} × ${pieza.product_name}` : "Toda la orden"}
              </dd>
              <dt className="text-zinc-500">Almacén</dt>
              <dd className="text-zinc-900">{nombreAlmacen}</dd>
              <dt className="text-zinc-500">Cantidad</dt>
              <dd className="font-semibold tabular-nums text-zinc-900" data-testid="consumo-cantidad">
                {normalizar(cantidadCanonica)} {unidad}
              </dd>
              <dt className="text-zinc-500">Saldo actual</dt>
              <dd className="tabular-nums text-zinc-900" data-testid="consumo-saldo-actual">
                {normalizar(saldoActual)} {unidad}
              </dd>
              <dt className="text-zinc-500">Saldo después</dt>
              <dd
                className={`font-semibold tabular-nums ${noAlcanza ? "text-red-700" : "text-zinc-900"}`}
                data-testid="consumo-saldo-despues"
              >
                {saldoDespues !== null ? normalizar(saldoDespues) : "—"} {unidad}
              </dd>
            </dl>
            <p className="text-[11px] text-zinc-500">
              El saldo después es una estimación con la existencia leída ahora. El
              definitivo lo calcula el sistema al registrar.
            </p>

            {noAlcanza ? (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                No hay stock suficiente para registrar este consumo: el saldo leído es{" "}
                {normalizar(saldoActual)} {unidad}.
              </p>
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>Este consumo generará un movimiento de inventario.</strong> No es un
                borrador: queda registrado. Si hubiera un error, se corrige con un ajuste de
                inventario.
              </p>
            )}

            {registrar.error ? (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {describeProductionError(registrar.error, "consumo")}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <SecondaryButton disabled={registrar.isPending} onClick={volverAEditar}>
                Volver a editar
              </SecondaryButton>
              <PrimaryButton
                type="button"
                disabled={registrar.isPending || noAlcanza}
                onClick={confirmar}
              >
                {registrar.isPending ? "Procesando…" : "Confirmar consumo"}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
