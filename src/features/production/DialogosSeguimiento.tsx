import { useEffect, useId, useRef, useState } from "react";

import { PrimaryButton, SecondaryButton, TextAreaField } from "@/components/form";
import { SelectField } from "@/components/SelectField";
import { useDialogoAccesible } from "@/features/cotizadorV2/useDialogoAccesible";
import { useKilns } from "@/features/firings/useFirings";
import {
  aCampoLima,
  dentroDeLaVentana,
  desdeCampoLima,
  HOLGURA_RELOJ_MS,
  instanteLimaExacto,
} from "@/features/production/instanteLima";
import {
  describeProductionError,
  MENSAJES_SUGERIDOS,
} from "@/features/production/mensajesProduccion";
import {
  useAddProductionNote,
  useIdempotencyKey,
  useRegisterCommunication,
} from "@/features/production/useProductionOrders";
import type { FiringKind, ProductionOrder } from "@/types/production";

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

/**
 * La fecha que se manda. Si la persona no tocó la propuesta («ahora»), es el
 * instante EXACTO del primer envío —con segundos—, y se conserva en los
 * reintentos: la clave de idempotencia compara también la fecha, y un «ahora»
 * nuevo en cada intento haría que el reintento pareciera otra nota.
 */
function useFechaDelEnvio() {
  const [tocada, setTocada] = useState(false);
  const congelado = useRef<string | null>(null);
  return {
    marcarTocada: () => setTocada(true),
    olvidar: () => {
      congelado.current = null;
    },
    fecha: (campo: string) => {
      if (tocada) return desdeCampoLima(campo);
      congelado.current ??= instanteLimaExacto();
      return congelado.current;
    },
  };
}

/**
 * Fecha y hora en Lima, acotada a la ventana que acepta el backend: desde que
 * se creó la orden hasta ahora (más la holgura del reloj). El backend vuelve a
 * comprobarlo; esto sólo avisa antes de enviar.
 */
function CampoFechaHora({
  label,
  value,
  onChange,
  creadaEn,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  creadaEn: string;
}) {
  const id = useId();
  const valida = dentroDeLaVentana(value, creadaEn);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-zinc-700">
        {label} <span className="font-normal text-zinc-500">(hora de Lima)</span>
      </label>
      <input
        id={id}
        type="datetime-local"
        value={value}
        min={aCampoLima(creadaEn)}
        max={aCampoLima(new Date(Date.now() + HOLGURA_RELOJ_MS))}
        onChange={(evento) => onChange(evento.target.value)}
        aria-invalid={!valida}
        className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900"
      />
      {!valida ? (
        <p className="mt-1 text-[11px] text-red-700">
          Debe estar entre la creación de la orden y ahora.
        </p>
      ) : null}
    </div>
  );
}

function Dialogo({
  titulo,
  children,
  onClose,
  bloqueado,
}: {
  titulo: string;
  children: React.ReactNode;
  onClose: () => void;
  bloqueado: boolean;
}) {
  const tituloId = useId();
  const contenedor = useDialogoAccesible<HTMLDivElement>(true);
  useEffect(() => {
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !bloqueado) onClose();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [onClose, bloqueado]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 sm:items-center sm:p-4"
    >
      <div
        ref={contenedor}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <h2 id={tituloId} className="text-base font-bold text-zinc-950">
          {titulo}
        </h2>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nota y quema (decisión D4)
// ---------------------------------------------------------------------------

const TIPOS_DE_QUEMA: readonly { value: FiringKind; label: string }[] = [
  { value: "LOW", label: "Quema baja" },
  { value: "HIGH", label: "Quema alta" },
];

/**
 * Una nota libre o una QUEMA real. La quema es una nota estructurada —horno,
 * tipo y cuándo— y no una hornada: una hornada lleva piezas de varias órdenes
 * y pertenece al horno. Los campos son exactamente los que acepta el backend.
 */
export function DialogoNota({
  order,
  quema,
  onClose,
  onRegistered,
}: {
  order: ProductionOrder;
  quema: boolean;
  onClose: () => void;
  onRegistered: () => void;
}) {
  const anotar = useAddProductionNote(order.id);
  const { key, renovar } = useIdempotencyKey();
  const envio = useFechaDelEnvio();
  // Reintentar lo MISMO reutiliza la clave; cambiar algo después de un intento
  // fallido es otra nota, y necesita otra clave o el backend la rechazaría.
  const editar =
    <T,>(asignar: (valor: T) => void) =>
    (valor: T) => {
      if (anotar.isError) {
        anotar.reset();
        renovar();
        envio.olvidar();
      }
      asignar(valor);
    };
  const hornos = useKilns({ active: true, limit: 100 });
  const [texto, setTexto] = useState("");
  const [kilnId, setKilnId] = useState("");
  const [tipo, setTipo] = useState<FiringKind | "">("");
  const [cuando, setCuando] = useState(() => aCampoLima(new Date()));

  const completo = quema
    ? kilnId !== "" && tipo !== "" && dentroDeLaVentana(cuando, order.created_at)
    : texto.trim() !== "" && dentroDeLaVentana(cuando, order.created_at);

  const enviar = () => {
    if (anotar.isPending || !completo) return;
    anotar.mutate(
      {
        kind: quema ? "FIRING_NOTE" : "NOTE",
        ...(texto.trim() ? { body: texto.trim() } : {}),
        ...(quema ? { kiln_id: Number(kilnId), firing_type: tipo as FiringKind } : {}),
        occurred_at: envio.fecha(cuando),
        idempotency_key: key,
      },
      { onSuccess: onRegistered },
    );
  };

  return (
    <Dialogo
      titulo={quema ? "Registrar quema" : "Añadir nota"}
      onClose={onClose}
      bloqueado={anotar.isPending}
    >
      <p className="mt-1 text-xs text-zinc-600">
        {quema
          ? "Deja constancia de que las piezas de esta orden pasaron por una quema. No mueve inventario."
          : "Queda en el seguimiento de la orden. No se edita ni se borra después."}
      </p>
      <div className="mt-4 space-y-3">
        {quema ? (
          <>
            <SelectField
              label="Horno"
              requirement="required"
              value={kilnId}
              searchable={false}
              placeholder={hornos.isPending ? "Cargando hornos…" : "Elija el horno"}
              options={(hornos.data?.items ?? []).map((horno) => ({
                value: String(horno.id),
                label: horno.name,
              }))}
              onChange={editar(setKilnId)}
            />
            <SelectField
              label="Tipo de quema"
              requirement="required"
              value={tipo}
              searchable={false}
              placeholder="Elija el tipo"
              options={TIPOS_DE_QUEMA}
              onChange={editar((valor: string) => setTipo(valor as FiringKind))}
            />
          </>
        ) : null}
        <CampoFechaHora
          label={quema ? "Cuándo fue la quema" : "Cuándo ocurrió"}
          value={cuando}
          onChange={editar((valor: string) => {
            envio.marcarTocada();
            setCuando(valor);
          })}
          creadaEn={order.created_at}
        />
        <TextAreaField
          label={quema ? "Observación" : "Nota"}
          requirement={quema ? "optional" : "required"}
          value={texto}
          rows={3}
          onChange={editar(setTexto)}
        />
        {anotar.error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {describeProductionError(anotar.error, "nota")}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton disabled={anotar.isPending} onClick={onClose}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="button" disabled={!completo || anotar.isPending} onClick={enviar}>
            {anotar.isPending ? "Procesando…" : quema ? "Registrar quema" : "Guardar nota"}
          </PrimaryButton>
        </div>
      </div>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------------
// Comunicación con el cliente (decisión D2)
// ---------------------------------------------------------------------------


/**
 * REGISTRAR un aviso que ya se hizo. El sistema no envía nada: no hay
 * integración con WhatsApp ni con ningún proveedor, y el texto lo dice así
 * para que nadie crea que el mensaje salió desde aquí.
 *
 * Vale en cualquier estado: «puede pasar a recoger» se dice con la orden
 * finalizada y «su pedido se anuló», con la anulada. El autor lo pone la
 * sesión en el backend; aquí no se elige.
 */
export function DialogoComunicacion({
  order,
  onClose,
  onRegistered,
}: {
  order: ProductionOrder;
  onClose: () => void;
  onRegistered: () => void;
}) {
  const registrar = useRegisterCommunication(order.id);
  const { key, renovar } = useIdempotencyKey();
  const envio = useFechaDelEnvio();
  const editar =
    <T,>(asignar: (valor: T) => void) =>
    (valor: T) => {
      if (registrar.isError) {
        registrar.reset();
        renovar();
        envio.olvidar();
      }
      asignar(valor);
    };
  const [mensaje, setMensaje] = useState("");
  const [cuando, setCuando] = useState(() => aCampoLima(new Date()));

  const completo = mensaje.trim() !== "" && dentroDeLaVentana(cuando, order.created_at);

  const enviar = () => {
    if (registrar.isPending || !completo) return;
    registrar.mutate(
      {
        channel: "WHATSAPP",
        // Se manda tal cual: el backend sólo recorta los extremos y conserva
        // los saltos de línea que escribió la persona.
        message: mensaje,
        sent_at: envio.fecha(cuando),
        idempotency_key: key,
      },
      { onSuccess: onRegistered },
    );
  };

  return (
    <Dialogo titulo="Registrar comunicación" onClose={onClose} bloqueado={registrar.isPending}>
      <p className="mt-1 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
        Deja constancia de un aviso que <strong>ya hiciste</strong> por tu cuenta. El sistema no
        envía ningún mensaje.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <p className="text-xs font-semibold text-zinc-700">Canal</p>
          <p className="mt-1 text-sm text-zinc-900">WhatsApp (registrado a mano)</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-zinc-700">Textos sugeridos</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {MENSAJES_SUGERIDOS.map((sugerido) => (
              <button
                key={sugerido.etiqueta}
                type="button"
                onClick={() => editar(setMensaje)(sugerido.texto)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                {sugerido.etiqueta}
              </button>
            ))}
          </div>
        </div>
        <TextAreaField
          label="Mensaje que enviaste"
          requirement="required"
          value={mensaje}
          rows={4}
          onChange={editar(setMensaje)}
          hint="Puedes editarlo: se registra el texto final."
        />
        <CampoFechaHora
          label="Fecha y hora del aviso"
          value={cuando}
          onChange={editar((valor: string) => {
            envio.marcarTocada();
            setCuando(valor);
          })}
          creadaEn={order.created_at}
        />
        {registrar.error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {describeProductionError(registrar.error, "comunicacion")}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton disabled={registrar.isPending} onClick={onClose}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="button" disabled={!completo || registrar.isPending} onClick={enviar}>
            {registrar.isPending ? "Procesando…" : "Registrar comunicación"}
          </PrimaryButton>
        </div>
      </div>
    </Dialogo>
  );
}
