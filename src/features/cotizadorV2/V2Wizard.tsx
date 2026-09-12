import { useNavigate } from "react-router-dom";

import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { Panel } from "@/features/masters/MasterTable";
import { V2ClienteStep } from "@/features/cotizadorV2/V2ClienteStep";
import { V2FiringPanel } from "@/features/cotizadorV2/V2FiringPanel";
import { V2LaborLines } from "@/features/cotizadorV2/V2LaborLines";
import { V2PricingPanel } from "@/features/cotizadorV2/V2PricingPanel";
import { V2ProductLines } from "@/features/cotizadorV2/V2ProductLines";
import { V2ResumenStep } from "@/features/cotizadorV2/V2ResumenStep";
import { useV2Quotation } from "@/features/cotizadorV2/useQuoterV2";
import { useV2Firing } from "@/features/cotizadorV2/useQuoterV2Firing";
import { useV2Labor } from "@/features/cotizadorV2/useQuoterV2Labor";
import { useV2QuotationProducts } from "@/features/cotizadorV2/useQuoterV2Materials";
import { useV2Pricing } from "@/features/cotizadorV2/useQuoterV2Pricing";
import {
  PASOS,
  evaluarPasos,
  primerPasoIncompleto,
  type DatosDelFlujo,
  type EstadoPaso,
  type PasoId,
} from "@/features/cotizadorV2/pasos";

/**
 * El flujo de siete pasos del Cotizador V2. Fase 010G.
 *
 * Hasta aquí los módulos existían y funcionaban, pero apilados: la ficha
 * pintaba cinco paneles a la vez y quien cotizaba tenía que saber en qué orden
 * mirarlos. Esto los convierte en un camino.
 *
 * ## Navegar no es editar
 *
 * Volver al paso 1 para comprobar quién es el cliente no puede reescribir nada.
 * Por eso ningún paso guarda al montarse ni al desmontarse: cada campo guarda
 * cuando quien lo edita sale de él, y nada más. Una cotización que cambiara de
 * precio por haberla mirado sería inutilizable.
 *
 * Corolario: no hay «borrador sin guardar» que perder. Lo editado ya está en el
 * servidor cuando se cambia de paso, así que recargar, cerrar el navegador o
 * volver mañana devuelve exactamente lo que había.
 *
 * ## El paso vive en la URL
 *
 * Ni en un estado local —que se perdería al recargar— ni en la base, que
 * habría pedido una migración para guardar un número que se puede inferir. Así
 * el botón «atrás» funciona, recargar no pierde el sitio y un enlace lleva a
 * quien lo abre al mismo lugar.
 *
 * ## Se puede saltar a cualquier paso
 *
 * Los indicadores son botones, incluso hacia pasos incompletos. Un asistente
 * que obliga a rellenar en orden estricto es exactamente lo que hace que la
 * gente abra una cotización nueva en vez de arreglar la que tiene.
 */

/** Qué pinta cada paso. */
function Contenido({
  paso,
  quotationId,
  canEdit,
  datos,
  estados,
  irAPaso,
}: {
  paso: PasoId;
  quotationId: number;
  canEdit: boolean;
  datos: DatosDelFlujo;
  estados: readonly EstadoPaso[];
  irAPaso: (paso: PasoId) => void;
}) {
  switch (paso) {
    case "cliente":
      return datos.cotizacion ? (
        <V2ClienteStep cotizacion={datos.cotizacion} canEdit={canEdit} />
      ) : null;
    case "productos":
      return <V2ProductLines quotationId={quotationId} canEdit={canEdit} vista="piezas" />;
    case "materiales":
      return <V2ProductLines quotationId={quotationId} canEdit={canEdit} vista="materiales" />;
    case "mano-de-obra":
      return <V2LaborLines quotationId={quotationId} canEdit={canEdit} />;
    case "quema":
      return <V2FiringPanel quotationId={quotationId} canEdit={canEdit} />;
    case "precio":
      return <V2PricingPanel quotationId={quotationId} canEdit={canEdit} />;
    case "resumen":
      return <V2ResumenStep datos={datos} estados={estados} irAPaso={irAPaso} />;
  }
}

/**
 * Un paso en la barra de arriba.
 *
 * El estado NO se dice solo con color: quien no distingue el ámbar del verde
 * vería siete casillas iguales. Va un símbolo y, en el paso actual, también la
 * palabra; el resto lo lleva en el `title` y en el texto para lectores de
 * pantalla.
 */
function Indicador({
  indice,
  titulo,
  estado,
  actual,
  onClick,
}: {
  indice: number;
  titulo: string;
  estado: EstadoPaso;
  actual: boolean;
  onClick: () => void;
}) {
  const avisos = estado.senales.filter((senal) => senal.severidad !== "error").length;
  const situacion = !estado.completo
    ? { simbolo: "!", texto: "incompleto", clase: "text-red-700 ring-red-300 bg-red-50" }
    : avisos > 0
      ? { simbolo: "✓", texto: "con avisos", clase: "text-amber-800 ring-amber-300 bg-amber-50" }
      : { simbolo: "✓", texto: "listo", clase: "text-emerald-800 ring-emerald-300 bg-emerald-50" };

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={actual ? "step" : undefined}
        title={`${titulo}: ${situacion.texto}`}
        className={[
          "flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs ring-1 transition",
          situacion.clase,
          actual ? "font-semibold ring-2 ring-offset-1 ring-offset-white" : "opacity-80",
        ].join(" ")}
      >
        <span aria-hidden="true" className="font-bold">
          {situacion.simbolo}
        </span>
        <span>
          <span className="block">
            {indice + 1}. {titulo}
          </span>
          <span className={actual ? "block text-[11px] font-normal" : "sr-only"}>
            {situacion.texto}
          </span>
        </span>
      </button>
    </li>
  );
}

export function V2Wizard({ quotationId, paso }: { quotationId: number; paso: PasoId | null }) {
  const navigate = useNavigate();

  // Las cinco consultas del flujo. Cada panel pide además las suyas, pero
  // TanStack las comparte por clave: esto no duplica ni una petición, y da a
  // la barra de pasos lo que necesita para juzgarlos todos a la vez.
  const cotizacion = useV2Quotation(quotationId);
  const productos = useV2QuotationProducts(quotationId);
  const manoDeObra = useV2Labor(quotationId);
  const quema = useV2Firing(quotationId);
  const precio = useV2Pricing(quotationId);

  const datos: DatosDelFlujo = {
    cotizacion: cotizacion.data,
    productos: productos.data,
    manoDeObra: manoDeObra.data,
    quema: quema.data,
    precio: precio.data,
  };
  const estados = evaluarPasos(datos);

  const irAPaso = (destino: PasoId) => navigate(`/cotizador-v2/${quotationId}/${destino}`);

  // Sin paso en la URL —o con uno que no existe— se lleva al primero que falte.
  // Al primero siempre haría repasar lo ya hecho; al último escondería lo que
  // falta. Se espera a tener datos: decidir sobre una cotización a medio cargar
  // mandaría a todo el mundo al paso 1.
  const cargando = cotizacion.isPending || productos.isPending;
  const actual: PasoId = paso ?? (cargando ? "cliente" : primerPasoIncompleto(estados));

  if (cargando) return <Spinner className="size-5" label="Cargando la cotización..." />;

  const indice = PASOS.findIndex((item) => item.id === actual);
  const anterior = indice > 0 ? PASOS[indice - 1] : undefined;
  const siguiente = indice < PASOS.length - 1 ? PASOS[indice + 1] : undefined;
  const estadoActual = estados[indice];
  const canEdit = cotizacion.data?.status === "DRAFT";

  return (
    <div className="space-y-4">
      <Panel>
        <nav aria-label="Pasos de la cotización">
          <ol className="flex flex-wrap gap-2" data-testid="pasos-cotizacion">
            {PASOS.map((item, posicion) => {
              const estado = estados[posicion];
              if (!estado) return null;
              return (
                <Indicador
                  key={item.id}
                  indice={posicion}
                  titulo={item.titulo}
                  estado={estado}
                  actual={item.id === actual}
                  onClick={() => irAPaso(item.id)}
                />
              );
            })}
          </ol>
        </nav>
      </Panel>

      {estadoActual && estadoActual.senales.length > 0 ? (
        <ul data-testid="senales-del-paso" className="space-y-1">
          {estadoActual.senales.map((senal, posicion) => (
            <li
              key={`${senal.severidad}-${posicion}`}
              role={senal.severidad === "error" ? "alert" : undefined}
              className={[
                "rounded-xl px-3 py-2 text-xs",
                senal.severidad === "error"
                  ? "bg-red-50 text-red-700"
                  : senal.severidad === "aviso"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-sky-50 text-sky-800",
              ].join(" ")}
            >
              <span className="font-semibold">
                {senal.severidad === "error"
                  ? "Falta: "
                  : senal.severidad === "aviso"
                    ? "Aviso: "
                    : "Recomendación: "}
              </span>
              {senal.mensaje}
            </li>
          ))}
        </ul>
      ) : null}

      <Contenido
        paso={actual}
        quotationId={quotationId}
        canEdit={canEdit}
        datos={datos}
        estados={estados}
        irAPaso={irAPaso}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4">
        <div>
          {anterior ? (
            <SecondaryButton type="button" onClick={() => irAPaso(anterior.id)}>
              ← {anterior.titulo}
            </SecondaryButton>
          ) : null}
        </div>
        {/* No hay botón de «guardar borrador»: cada campo guarda al salir de él,
            así que no queda nada pendiente que un botón pudiera confirmar. Uno
            que no hiciera nada solo serviría para que alguien creyera que sin
            pulsarlo se pierde el trabajo. */}
        <p className="text-[11px] text-zinc-400">Los cambios se guardan solos al salir de cada campo.</p>
        <div>
          {siguiente ? (
            <PrimaryButton type="button" onClick={() => irAPaso(siguiente.id)}>
              {siguiente.titulo} →
            </PrimaryButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
