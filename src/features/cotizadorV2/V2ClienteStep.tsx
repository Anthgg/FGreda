import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchPartners } from "@/api/masters";
import {
  seguirEnvio,
  useBorradorProtegido,
  useUltimoDescarte,
  type ResultadoDeGuardado,
} from "@/components/borradores";
import { DecimalField } from "@/components/DecimalField";
import { SelectField, TextAreaField, TextField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { describeError } from "@/features/settings/messages";
import { esMonedaExtranjera } from "@/features/cotizadorV2/pasos";
import { useUpdateV2Quotation } from "@/features/cotizadorV2/useQuoterV2";
import { useEsperarGuardado } from "@/features/cotizadorV2/claves";
import {
  V2_PRODUCTION_TYPE_LABEL,
  type V2CustomerKind,
  type V2ProductionType,
  type V2Quotation,
} from "@/types/quoterV2";

/**
 * Paso 1: a quién se cotiza y en qué condiciones. Fase 010G.
 *
 * Es el único paso sin un solo número de costo, y es deliberado: quien empieza
 * una cotización no tiene por qué ver un factor comercial ni un costo de gas
 * antes de haber elegido el cliente.
 *
 * ## Lo de aquí es de ESTA cotización
 *
 * Cliente, nombre, moneda, tipo de producción y tipo de cliente. Nada toca un
 * maestro: cambiar aquí la moneda no cambia la moneda de la casa. Eso vive en
 * Configuración, y mezclarlo sería la forma más rápida de que una cotización
 * cambiara el precio de todas las demás.
 *
 * ## El tipo de producción mueve el horno sugerido, y solo sugerido
 *
 * Por menor apunta al horno chico y por mayor al grande. El backend lo mueve
 * únicamente si nadie había elegido otro a mano; una decisión explícita manda
 * sobre un valor por defecto. Y nunca cambia solo por la cantidad de piezas:
 * esa es la confusión que cerró 010E.
 */

const TIPOS_CLIENTE: readonly { value: V2CustomerKind; label: string }[] = [
  { value: "EXTERNAL", label: "Cliente externo" },
  { value: "STUDENT", label: "Alumno" },
];

const MONEDAS = [
  { value: "PEN", label: "Soles (PEN)" },
  { value: "USD", label: "Dólares (USD)" },
];

const TIPOS_PRODUCCION: readonly V2ProductionType[] = ["RETAIL", "WHOLESALE"];

const SIN_CLIENTE = "";

/**
 * Espera a que quien escribe pare antes de dejar viajar el texto.
 *
 * Sin esto, teclear un nombre de diez letras eran diez peticiones al maestro de
 * terceros, y diez respuestas que podian llegar desordenadas: la de «Ma» podia
 * resolverse despues de la de «Maria» y dejar en pantalla la lista equivocada.
 */
function useEspera(valor: string, milisegundos = 300): string {
  const [reposado, setReposado] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setReposado(valor), milisegundos);
    return () => clearTimeout(temporizador);
  }, [valor, milisegundos]);
  return reposado;
}

/**
 * Texto que se guarda al SALIR del campo, no en cada tecla.
 *
 * La misma razón que en `DecimalField`: escribir un nombre de ocho letras no
 * son ocho peticiones, y una edición que acaba donde empezó no gasta ninguna.
 */
function useTextoDiferido(
  guardado: string,
  guardar: (valor: string | null) => void | Promise<ResultadoDeGuardado>,
  habilitado: boolean,
) {
  const [borrador, setBorrador] = useState(guardado);
  const [escribiendo, setEscribiendo] = useState(false);
  // Lo enviado: tras salir del campo se sigue enseñando hasta que lo guardado
  // coincida con ello. Sin esto el campo volvía a pintar el valor ANTERIOR hasta
  // el refetch, y quien
  // volvía a entrar enseguida editaba el viejo.
  const [enviado, setEnviado] = useState<{ valor: string } | null>(null);
  // No se sincroniza con lo guardado mientras el campo está abierto. Lo encontró
  // Codex: escribir «Feria», salir —se guarda—, volver a entrar y seguir con
  // «Feria de octubre»; al llegar el refetch lo guardado pasa a «Feria» y, sin
  // esta guarda, el efecto borraba « de octubre» sin blur y sin aviso. Los
  // campos numéricos y los de las líneas ya lo hacían; este se había quedado.
  useEffect(() => {
    if (escribiendo) return;
    if (enviado !== null) {
      // Solo si COINCIDE: que lo guardado cambie por un envío anterior no
      // alcanza este. Ver `DecimalField`.
      const alcanzado = guardado.trim() === enviado.valor.trim();
      if (!alcanzado) return;
      setEnviado(null);
    }
    setBorrador(guardado);
  }, [guardado, escribiendo, enviado]);

  // Cada envío lleva un número; solo el resultado del ÚLTIMO dice algo de lo
  // que el campo enseña. Si el servidor lo aceptó Y la pantalla ya tiene el
  // dato posterior al guardado (`fresco`), el campo enseña lo guardado tal cual
  // lo normalizó el backend: `20,5000004` pasa a `20.5`. Aceptado sin dato
  // fresco, sigue enseñando lo enviado. Si falla, se recuerda su firma para que
  // un descarte sepa que es este campo el que tiene que revertir.
  const envios = useRef(0);
  const [firmaFallida, setFirmaFallida] = useState<string | null>(null);
  const seguir = (resultado: unknown) => {
    const secuencia = ++envios.current;
    seguirEnvio(
      resultado,
      () => envios.current === secuencia,
      (final) => {
        if (final.ok) {
          setFirmaFallida(null);
          // Solo con un dato posterior a ESTE guardado. Si el refetch no llegó,
          // se sigue enseñando lo enviado: alinearse con lo que hay pintaría
          // el valor viejo, y quien volviera a entrar editaría lo obsoleto.
          if (final.fresco !== false) setEnviado(null);
        } else {
          setFirmaFallida(final.firma);
        }
      },
    );
  };

  const confirmar = () => {
    setEscribiendo(false);
    if (borrador.trim() === guardado.trim()) return;
    // Vaciar un texto libre SÍ es retirarlo: a diferencia de un importe, un
    // nombre en blanco no puede confundirse con un cero.
    setEnviado({ valor: borrador });
    seguir(guardar(borrador.trim() === "" ? null : borrador));
  };
  // Lo YA enviado no cuenta como borrador, y sin permiso de edición no se
  // declara ni se confirma nada. Ver `DecimalField`.
  const sucio =
    habilitado &&
    borrador.trim() !== guardado.trim() &&
    (enviado === null || borrador.trim() !== enviado.valor.trim());
  useBorradorProtegido(sucio, confirmar);

  // El descarte es DIRIGIDO: solo vuelve a lo guardado el campo cuyo último
  // envío falló con la firma descartada. Un campo con un envío en vuelo no lo
  // escucha, porque su guardado todavía puede salir bien.
  const descarte = useUltimoDescarte();
  const descarteVisto = useRef(descarte.n);
  useEffect(() => {
    if (descarte.n === descarteVisto.current) return;
    descarteVisto.current = descarte.n;
    if (escribiendo || firmaFallida === null || firmaFallida !== descarte.firma) return;
    setFirmaFallida(null);
    setEnviado(null);
  }, [descarte, escribiendo, firmaFallida]);

  return {
    borrador,
    setBorrador,
    alEntrar: () => setEscribiendo(true),
    confirmar,
  };
}

export function V2ClienteStep({
  cotizacion,
  canEdit,
}: {
  cotizacion: V2Quotation;
  canEdit: boolean;
}) {
  const guardar = useUpdateV2Quotation(cotizacion.id);
  const esperarGuardado = useEsperarGuardado(cotizacion.id);
  const [busqueda, setBusqueda] = useState("");

  const nombre = useTextoDiferido(
    cotizacion.name ?? "",
    (name) => esperarGuardado(guardar, "cabecera", { name }),
    canEdit,
  );
  const notas = useTextoDiferido(
    cotizacion.notes ?? "",
    (notes) => esperarGuardado(guardar, "cabecera", { notes }),
    canEdit,
  );
  // Fase 010H. Lo que SÍ lee el cliente: sale en el PDF. Va aparte de las notas
  // internas para que nadie publique sin querer lo que escribió para el taller.
  const notasCliente = useTextoDiferido(
    cotizacion.client_notes ?? "",
    (client_notes) => esperarGuardado(guardar, "cabecera", { client_notes }),
    canEdit,
  );

  const busquedaReposada = useEspera(busqueda);
  const terceros = useQuery({
    queryKey: ["quoter-v2", "clientes", busquedaReposada],
    // Sin texto se traen los primeros veinte: abrir el paso y no ver nada
    // obligaría a adivinar que hay que escribir algo para que aparezca algo.
    queryFn: () => fetchPartners({ search: busquedaReposada, active: true, limit: 20 }),
  });

  const esExtranjera = esMonedaExtranjera(cotizacion.currency_code);

  // El filtro `role` del backend es exacto, y quien es CLIENT y quien es BOTH
  // valen igual como cliente: se piden todos y se criban aquí. Ofrecer un
  // proveedor puro solo serviría para que el guardado lo rechazara después.
  const opcionesCliente = [
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
  // desplegable enseñaría «Seleccionar...» sobre una cotización que sí tiene
  // cliente, que es la forma más rápida de que alguien lo vuelva a elegir.
  const idActual = cotizacion.customer_id === null ? SIN_CLIENTE : String(cotizacion.customer_id);
  if (idActual !== SIN_CLIENTE && !opcionesCliente.some((o) => o.value === idActual)) {
    opcionesCliente.splice(1, 0, {
      value: idActual,
      label: cotizacion.customer_name ?? `Cliente #${idActual}`,
    });
  }

  return (
    <div data-testid="paso-cliente" className="space-y-5">
      <header>
        <h2 className="text-sm font-semibold text-zinc-900">Cliente y datos de la cotización</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Lo que se elija aquí vale solo para esta cotización. Los valores de la casa se cambian en
          Configuración.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Buscar cliente"
          requirement="optional"
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Nombre, DNI o RUC"
          disabled={!canEdit}
          hint="Se buscan terceros activos con rol de cliente."
        />
        <SelectField
          label="Cliente"
          requirement="required"
          value={idActual}
          options={opcionesCliente}
          onChange={(valor) =>
            guardar.mutate({
              customer_id: valor === SIN_CLIENTE ? null : Number(valor),
            })
          }
          disabled={!canEdit}
          {...(terceros.isPending ? { hint: "Cargando terceros..." } : {})}
        />

        <TextField
          label="Nombre de la cotización"
          requirement="optional"
          value={nombre.borrador}
          onChange={nombre.setBorrador}
          onFocus={nombre.alEntrar}
          onBlur={nombre.confirmar}
          placeholder="Pedido de tazas — setiembre"
          disabled={!canEdit}
          maxLength={200}
          hint="Para reconocerla en el listado. No sale en el documento."
        />
        <SelectField
          label="Tipo de producción"
          requirement="required"
          value={cotizacion.production_type}
          options={TIPOS_PRODUCCION.map((valor) => ({
            value: valor,
            label: V2_PRODUCTION_TYPE_LABEL[valor],
          }))}
          onChange={(valor) => guardar.mutate({ production_type: valor })}
          disabled={!canEdit}
          hint="Sugiere un horno: chico para por menor, grande para por mayor. Puede cambiarlo en el paso de quema."
        />

        <SelectField
          label="Tipo de cliente"
          requirement="required"
          value={cotizacion.customer_kind ?? "EXTERNAL"}
          options={TIPOS_CLIENTE}
          onChange={(valor) => guardar.mutate({ customer_kind: valor })}
          disabled={!canEdit}
          hint="Cambia la tarifa de quema que se cobra. El gas que se consume es el mismo."
        />
        <SelectField
          label="Moneda"
          requirement="required"
          value={cotizacion.currency_code ?? "PEN"}
          options={MONEDAS}
          onChange={(valor) => guardar.mutate({ currency_code: valor })}
          disabled={!canEdit}
        />

        {esExtranjera ? (
          <DecimalField
            label="Tipo de cambio"
            requirement="required"
            value={cotizacion.exchange_rate}
            onCommit={(valor) =>
              valor !== null
                ? esperarGuardado(guardar, "cabecera", { exchange_rate: valor })
                : undefined
            }
            disabled={!canEdit}
            hint="Se congela en esta cotización: el precio pactado no cambia porque mañana cambie el dólar."
          />
        ) : null}
      </div>

      {/* `TextAreaField` no expone `onBlur`. El de React es `focusout`, que sí
          burbujea, así que el contenedor sirve para confirmar el borrador al
          salir del área. Cambiar la primitiva compartida por un solo uso
          saldría más caro. */}
      <div onFocus={notas.alEntrar} onBlur={notas.confirmar}>
        <TextAreaField
          label="Notas internas"
          requirement="optional"
          value={notas.borrador}
          onChange={notas.setBorrador}
          rows={2}
          disabled={!canEdit}
          hint="Para el taller. No salen en el documento del cliente."
        />
      </div>
      <div onFocus={notasCliente.alEntrar} onBlur={notasCliente.confirmar}>
        <TextAreaField
          label="Observaciones para el cliente"
          requirement="optional"
          value={notasCliente.borrador}
          onChange={notasCliente.setBorrador}
          rows={2}
          disabled={!canEdit}
          hint="Salen en el PDF que recibe el cliente, junto a las condiciones comerciales."
        />
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-black/[0.06] bg-white/40 p-4 sm:grid-cols-4">
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
          <dt className="text-xs text-zinc-500">Jornada</dt>
          <dd className="text-sm text-zinc-800">
            {cotizacion.workday_hours === null ? "—" : `${Number(cotizacion.workday_hours)} h`}
          </dd>
        </div>
      </dl>
      <p className="text-[11px] text-zinc-400">
        Estos cuatro quedaron congelados al crear la cotización. Cambiarlos en Configuración no
        altera las que ya existen.
      </p>

      {terceros.isError ? (
        <p role="alert" className="text-xs text-red-600">
          No se pudieron cargar los terceros. Vuelva a intentarlo.
        </p>
      ) : null}
      {guardar.isError ? (
        <p role="alert" className="text-xs text-red-600">
          {describeError(guardar.error)}
        </p>
      ) : null}
      {guardar.isPending ? (
        <p className="text-xs text-zinc-500">
          <Spinner className="size-3" label="Guardando..." />
        </p>
      ) : null}
    </div>
  );
}
