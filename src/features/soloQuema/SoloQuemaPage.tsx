import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/api/client";
import { fetchPartners } from "@/api/masters";
import { formatDisplayDate } from "@/components/dateFormat";
import { PrimaryButton, SelectField, TextAreaField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { EstadoV2 } from "@/features/cotizadorV2/V2CicloDeVida";
import { EmptyState, MasterHeader, Panel } from "@/features/masters/MasterTable";
import { describeError } from "@/features/settings/messages";
import { CampoDeTexto } from "@/features/soloQuema/CampoDeTexto";
import { SQEmisionPanel } from "@/features/soloQuema/SQEmisionPanel";
import { SQPiezasPanel } from "@/features/soloQuema/SQPiezasPanel";
import { SQPrecioPanel } from "@/features/soloQuema/SQPrecioPanel";
import { SQQuemaPanel } from "@/features/soloQuema/SQQuemaPanel";
import { SQVidriadoPanel } from "@/features/soloQuema/SQVidriadoPanel";
import {
  useCreateFiringQuotation,
  useFiringQuotation,
  useFiringQuotations,
  useUpdateFiringQuotation,
} from "@/features/soloQuema/useSoloQuema";
import { V2_EFFECTIVE_STATUS_LABEL, type V2CustomerKind } from "@/types/quoterV2";
import type { V2FiringQuotation } from "@/types/firingQuotationV2";

/**
 * SOLO QUEMA: el servicio de quemar piezas que el cliente ya trae. Fase 010K.
 *
 * No es el Cotizador V2 con cosas apagadas. Aquí no hay pasta, ni torno, ni
 * mano de obra de fabricación, y el factor va de ×1,00 a ×2,00 en vez del
 * ×2..×10 de una pieza hecha por el taller: lo que se vende es horno, no
 * cerámica. Su talonario también es propio —Q-V2—, porque un servicio de quema
 * y una cotización de fabricación no son el mismo documento.
 *
 * Tampoco es la Quema del módulo de producción: aquella registra hornadas que
 * ya ocurrieron; esta cotiza una que todavía no.
 *
 * La pantalla no calcula: todos los importes, la ocupación y el comparador de
 * hornos llegan del backend.
 */

const TIPOS_CLIENTE: readonly { value: V2CustomerKind; label: string }[] = [
  { value: "EXTERNAL", label: "Cliente externo" },
  { value: "STUDENT", label: "Alumno" },
];

const SIN_CLIENTE = "";

function Distintivo() {
  return (
    <span
      data-testid="solo-quema-badge"
      className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200"
    >
      Solo quema
    </span>
  );
}

/** Cliente, nombre y observaciones. Lo de aquí vale solo para este servicio. */
function Cabecera({
  cotizacion,
  canEdit,
}: {
  cotizacion: V2FiringQuotation;
  canEdit: boolean;
}) {
  const guardar = useUpdateFiringQuotation(cotizacion.id);
  const [busqueda, setBusqueda] = useState("");
  const [reposada, setReposada] = useState("");

  // Teclear diez letras no son diez peticiones al maestro de terceros, y diez
  // respuestas que pueden llegar desordenadas.
  useEffect(() => {
    const temporizador = setTimeout(() => setReposada(busqueda), 300);
    return () => clearTimeout(temporizador);
  }, [busqueda]);

  const terceros = useQuery({
    queryKey: ["solo-quema", "clientes", reposada],
    queryFn: () => fetchPartners({ search: reposada, active: true, limit: 20 }),
  });

  const opciones = [
    { value: SIN_CLIENTE, label: "Sin cliente todavía" },
    ...(terceros.data?.items ?? [])
      .filter((tercero) => tercero.role === "CLIENT" || tercero.role === "BOTH")
      .map((tercero) => ({
        value: String(tercero.id),
        label: tercero.document_number
          ? `${tercero.name} · ${tercero.document_number}`
          : tercero.name,
      })),
  ];

  // El cliente ya elegido puede no estar en la página buscada. Sin esto el
  // desplegable enseñaría «Seleccionar...» sobre un servicio que sí lo tiene.
  const actual =
    cotizacion.customer_id === null ? SIN_CLIENTE : String(cotizacion.customer_id);
  if (actual !== SIN_CLIENTE && !opciones.some((opcion) => opcion.value === actual)) {
    opciones.splice(1, 0, {
      value: actual,
      label: cotizacion.customer_name ?? `Cliente #${actual}`,
    });
  }

  return (
    <Panel>
      <div data-testid="panel-cliente-quema">
        <h2 className="text-sm font-semibold text-zinc-900">Cliente y datos del servicio</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Lo que se elija aquí vale solo para este servicio. Los valores de la casa se cambian en
          Configuración.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Buscar cliente"
            requirement="optional"
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Nombre, DNI o RUC"
            disabled={!canEdit}
          />
          <SelectField
            label="Cliente"
            requirement="required"
            value={actual}
            options={opciones}
            onChange={(valor) =>
              guardar.mutate({ customer_id: valor === SIN_CLIENTE ? null : Number(valor) })
            }
            disabled={!canEdit}
            {...(terceros.isPending ? { hint: "Cargando terceros..." } : {})}
          />
          <CampoDeTexto
            label="Nombre del servicio"
            requirement="optional"
            value={cotizacion.name ?? ""}
            onCommit={(name) => guardar.mutate({ name: name || null })}
            disabled={!canEdit}
            placeholder="Quema de piezas de Ana"
            hint="Para reconocerlo en el listado. No sale en el documento."
          />
          <SelectField
            label="Moneda"
            requirement="required"
            value={cotizacion.currency_code ?? "PEN"}
            options={[
              { value: "PEN", label: "Soles (PEN)" },
              { value: "USD", label: "Dólares (USD)" },
            ]}
            onChange={(valor) => guardar.mutate({ currency_code: valor })}
            disabled={!canEdit}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextAreaField
            label="Notas internas"
            requirement="optional"
            value={cotizacion.notes ?? ""}
            onChange={(notes) => guardar.mutate({ notes: notes || null })}
            rows={2}
            disabled={!canEdit}
            hint="Para el taller. No salen en el documento."
          />
          <TextAreaField
            label="Observaciones para el cliente"
            requirement="optional"
            value={cotizacion.client_notes ?? ""}
            onChange={(client_notes) => guardar.mutate({ client_notes: client_notes || null })}
            rows={2}
            disabled={!canEdit}
            hint="Salen en el PDF, junto a las condiciones."
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 rounded-2xl border border-black/[0.06] p-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-zinc-500">Código</dt>
            <dd className="text-sm text-zinc-800">{cotizacion.code}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Vigencia</dt>
            <dd className="text-sm text-zinc-800">
              {cotizacion.validity_days === null ? "—" : `${cotizacion.validity_days} días`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">IGV</dt>
            <dd className="text-sm text-zinc-800">
              {cotizacion.tax_percent === null ? "—" : `${Number(cotizacion.tax_percent)} %`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Creada</dt>
            <dd className="text-sm text-zinc-800">{formatDisplayDate(cotizacion.created_at)}</dd>
          </div>
        </dl>

        {guardar.isError ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {describeError(guardar.error)}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function Ficha({ id }: { id: number }) {
  const query = useFiringQuotation(id);

  if (query.isPending) return <Spinner label="Cargando el servicio de quema" />;
  if (query.isError) {
    const mensaje =
      query.error instanceof ApiError && query.error.status === 404
        ? "Ese servicio de quema no existe. Comprueba el enlace."
        : "No se pudo cargar el servicio de quema.";
    return <EmptyState message={mensaje} />;
  }

  const cotizacion = query.data;
  const canEdit = cotizacion.status === "DRAFT";

  return (
    <div className="space-y-6" data-testid="ficha-solo-quema">
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/solo-quema" className="text-xs text-zinc-500 hover:underline">
            &larr; Servicios de quema
          </Link>
          <h2 className="text-base font-semibold text-zinc-900">{cotizacion.code}</h2>
          <Distintivo />
          <EstadoV2 estado={cotizacion.effective_status} />
        </div>
        {canEdit ? null : (
          <p className="mt-2 text-xs text-zinc-500">
            Ya emitida: no se edita. Para cambiar algo, duplíquela.
          </p>
        )}
      </Panel>

      <Cabecera cotizacion={cotizacion} canEdit={canEdit} />
      <SQPiezasPanel cotizacion={cotizacion} canEdit={canEdit} />
      <SQQuemaPanel cotizacion={cotizacion} canEdit={canEdit} />
      <SQVidriadoPanel cotizacion={cotizacion} canEdit={canEdit} />
      <SQPrecioPanel cotizacion={cotizacion} canEdit={canEdit} />
      <SQEmisionPanel cotizacion={cotizacion} />
    </div>
  );
}

export function SoloQuemaPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [tipoCliente, setTipoCliente] = useState<V2CustomerKind>("EXTERNAL");
  const [notas, setNotas] = useState("");

  const crear = useCreateFiringQuotation();
  const listado = useFiringQuotations();

  // `/solo-quema/loquesea` es una FICHA que no existe, no un alta nueva: sin
  // esta distinción la pantalla enseñaría el formulario de creación con una
  // dirección de detalle en la barra.
  const numero = id === undefined ? null : Number(id);
  const esDetalle = id !== undefined;
  const valido = numero !== null && Number.isInteger(numero) && numero > 0;

  return (
    <div className="space-y-6">
      <MasterHeader
        title={
          <TypewriterTitle
            text="Solo quema."
            className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
          />
        }
        subtitle="Quemar piezas que trae el cliente. Sin pasta, sin torno: lo que se vende es el horno."
        actions={<Distintivo />}
      />

      {esDetalle ? (
        valido ? (
          <Ficha id={numero} />
        ) : (
          <EmptyState message="Ese servicio de quema no existe. Comprueba el enlace." />
        )
      ) : (
        <>
          <Panel>
            <h2 className="text-sm font-semibold text-zinc-900">Nuevo servicio de quema</h2>
            <p className="mt-1 text-xs text-zinc-500">
              El cliente y las piezas se completan después. Lo único que hace falta para empezar es
              abrirlo.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Nombre"
                requirement="optional"
                value={nombre}
                onChange={setNombre}
                maxLength={200}
                placeholder="Quema de piezas de Ana"
              />
              <SelectField
                label="Tipo de cliente"
                requirement="required"
                value={tipoCliente}
                options={TIPOS_CLIENTE}
                onChange={setTipoCliente}
                hint="Cambia la tarifa de quema que se cobra. El gas es el mismo."
              />
              <TextAreaField
                label="Notas internas"
                requirement="optional"
                value={notas}
                onChange={setNotas}
                rows={2}
                className="sm:col-span-2"
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <PrimaryButton
                type="button"
                onClick={() =>
                  crear.mutate(
                    {
                      name: nombre.trim() || null,
                      customer_kind: tipoCliente,
                      notes: notas.trim() || null,
                    },
                    { onSuccess: (datos) => navigate(`/solo-quema/${datos.id}`) },
                  )
                }
                disabled={crear.isPending}
              >
                {crear.isPending ? "Creando..." : "Crear servicio de quema"}
              </PrimaryButton>
              {crear.isError ? (
                <span role="alert" className="text-xs text-red-600">
                  {describeError(crear.error)}
                </span>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-sm font-semibold text-zinc-900">Últimos servicios de quema</h2>
            {listado.isPending ? (
              <div className="mt-4">
                <Spinner label="Cargando servicios de quema" />
              </div>
            ) : listado.isError ? (
              <EmptyState message="No se pudieron cargar los servicios de quema." />
            ) : listado.data.items.length === 0 ? (
              <EmptyState message="Todavía no hay servicios de quema." />
            ) : (
              <ul className="mt-4 divide-y divide-black/5" data-testid="listado-solo-quema">
                {listado.data.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/solo-quema/${item.id}`)}
                      className="cursor-pointer text-sm font-medium text-zinc-800 hover:underline"
                    >
                      {item.code}
                      {item.name ? (
                        <span className="ml-2 font-normal text-zinc-500">{item.name}</span>
                      ) : null}
                    </button>
                    <span className="flex items-center gap-2 text-xs text-zinc-500">
                      {item.customer_name ?? "Sin cliente"}
                      <strong className="text-zinc-700">{item.total_amount}</strong>
                      <EstadoV2 estado={item.effective_status} />
                      <span className="sr-only">
                        {V2_EFFECTIVE_STATUS_LABEL[item.effective_status]}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
