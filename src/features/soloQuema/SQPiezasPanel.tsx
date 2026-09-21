import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchProducts } from "@/api/masters";
import { DecimalField } from "@/components/DecimalField";
import { PrimaryButton, SelectField } from "@/components/form";
import { EmptyState, Panel } from "@/features/masters/MasterTable";
import { CampoDeTexto } from "@/features/soloQuema/CampoDeTexto";
import {
  useAddFiringQuotationLine,
  useDeleteFiringQuotationLine,
  useUpdateFiringQuotationLine,
} from "@/features/soloQuema/useSoloQuema";
import { describeError } from "@/features/settings/messages";
import type { V2FiringQuotation, V2FiringQuotationLine } from "@/types/firingQuotationV2";

/**
 * Las piezas que el cliente TRAE. Fase 010K.
 *
 * Aquí no hay pasta, ni peso, ni torno: en Solo Quema la pieza ya existe y lo
 * único que el taller pone es el horno. De cada fila salen tres cosas y nada
 * más: cuántas son, cuánto miden y, de ahí, el volumen que ocupan.
 *
 * El volumen y el reparto los calcula el backend y aquí solo se leen. Una
 * multiplicación de coma flotante compitiendo con la de `Decimal` acabaría
 * enseñando un porcentaje que no cuadra con el precio de al lado.
 *
 * La pieza puede venir del catálogo o escribirse a mano: quien trae seis tazas
 * de su casa no tiene por qué existir en el maestro de productos.
 */

const SIN_PRODUCTO = "";

const MEDIDAS = [
  { campo: "length_cm", etiqueta: "Largo (cm)" },
  { campo: "width_cm", etiqueta: "Ancho (cm)" },
  { campo: "height_cm", etiqueta: "Alto (cm)" },
] as const;

function Fila({
  cotizacionId,
  linea,
  productos,
  canEdit,
}: {
  cotizacionId: number;
  linea: V2FiringQuotationLine;
  productos: readonly { value: string; label: string }[];
  canEdit: boolean;
}) {
  const actualizar = useUpdateFiringQuotationLine(cotizacionId);
  const borrar = useDeleteFiringQuotationLine(cotizacionId);

  const guardar = (payload: Parameters<typeof actualizar.mutate>[0]["payload"]) =>
    actualizar.mutate({ lineId: linea.id, payload });

  return (
    <li className="rounded-2xl border border-black/[0.06] p-4" data-testid="pieza-quema">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Producto del catálogo"
          requirement="optional"
          value={linea.product_id === null ? SIN_PRODUCTO : String(linea.product_id)}
          options={[{ value: SIN_PRODUCTO, label: "Pieza suelta (sin catálogo)" }, ...productos]}
          onChange={(valor) =>
            guardar({ product_id: valor === SIN_PRODUCTO ? null : Number(valor) })
          }
          disabled={!canEdit}
          searchable
          hint="Opcional: la pieza que trae el cliente puede no estar en el maestro."
        />
        <CampoDeTexto
          label="Nombre de la pieza"
          requirement="required"
          value={linea.product_name ?? ""}
          onCommit={(product_name) => guardar({ product_name: product_name || null })}
          disabled={!canEdit}
          placeholder="Taza, plato hondo, escultura..."
          hint="Es lo que el cliente leerá en el documento."
        />
        <DecimalField
          label="Cantidad"
          requirement="required"
          value={String(linea.quantity)}
          entero
          onCommit={(valor) => {
            if (valor === null) return;
            guardar({ quantity: Number(valor) });
          }}
          disabled={!canEdit}
        />
        {MEDIDAS.map(({ campo, etiqueta }) => (
          <DecimalField
            key={campo}
            label={etiqueta}
            requirement="required"
            value={linea[campo]}
            onCommit={(valor) => guardar({ [campo]: valor })}
            disabled={!canEdit}
            hint="Vacío es «sin medir»: la pieza no ocuparía horno y el precio saldría corto."
          />
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 rounded-2xl bg-black/[0.03] px-4 py-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-zinc-500">Separación aplicada</dt>
          <dd className="text-sm text-zinc-800">{linea.separation_cm} cm</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Volumen de una</dt>
          <dd className="text-sm text-zinc-800">{linea.unit_volume_cm3} cm³</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Volumen total</dt>
          <dd className="text-sm text-zinc-800">{linea.total_volume_cm3} cm³</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">% del pedido</dt>
          <dd className="text-sm text-zinc-800">{linea.volume_share_percent} %</dd>
        </div>
      </dl>

      {canEdit ? (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => borrar.mutate(linea.id)}
            disabled={borrar.isPending}
            className="cursor-pointer text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            Quitar esta pieza
          </button>
          {borrar.isError ? (
            <span role="alert" className="text-xs text-red-600">
              {describeError(borrar.error)}
            </span>
          ) : null}
        </div>
      ) : null}

      {actualizar.isError ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {describeError(actualizar.error)}
        </p>
      ) : null}
    </li>
  );
}

export function SQPiezasPanel({
  cotizacion,
  canEdit,
}: {
  cotizacion: V2FiringQuotation;
  canEdit: boolean;
}) {
  const [nombre, setNombre] = useState("");
  const anadir = useAddFiringQuotationLine(cotizacion.id);

  const catalogo = useQuery({
    queryKey: ["solo-quema", "productos"],
    queryFn: () => fetchProducts({ limit: 100, active: true }),
  });

  const productos = (catalogo.data?.items ?? []).map((producto) => ({
    value: String(producto.id),
    label: producto.name,
  }));

  return (
    <Panel>
      <div data-testid="panel-piezas-quema">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Piezas que se van a quemar</h2>
          <span className="text-xs text-zinc-500">
            Volumen total: <strong>{cotizacion.total_volume_cm3} cm³</strong>
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Las piezas las trae el cliente. El taller solo pone el horno, así que de cada una hace
          falta la cantidad y las tres medidas: de ahí sale el volumen y de ahí las hornadas.
        </p>

        {canEdit ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <CampoDeTexto
              label="Nueva pieza"
              requirement="optional"
              value={nombre}
              onCommit={setNombre}
              disabled={anadir.isPending}
              placeholder="Taza de Ana"
              hint="Puede dejarlo vacío y ponerle nombre después."
            />
            <PrimaryButton
              type="button"
              onClick={() =>
                anadir.mutate(
                  { product_name: nombre.trim() || null, quantity: 1 },
                  { onSuccess: () => setNombre("") },
                )
              }
              disabled={anadir.isPending}
            >
              {anadir.isPending ? "Añadiendo..." : "Añadir pieza"}
            </PrimaryButton>
            {anadir.isError ? (
              <span role="alert" className="text-xs text-red-600">
                {describeError(anadir.error)}
              </span>
            ) : null}
          </div>
        ) : null}

        {cotizacion.lines.length === 0 ? (
          <div className="mt-4">
            <EmptyState message="Todavía no hay piezas que quemar." />
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {cotizacion.lines.map((linea) => (
              <Fila
                key={linea.id}
                cotizacionId={cotizacion.id}
                linea={linea}
                productos={productos}
                canEdit={canEdit}
              />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
