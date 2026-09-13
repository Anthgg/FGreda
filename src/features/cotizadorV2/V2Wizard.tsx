import { useEffect } from "react";
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
import { DESTINO_DE_GUARDADO } from "@/features/cotizadorV2/claves";
import { useEstadoDeGuardado } from "@/features/cotizadorV2/useEstadoDeGuardado";
import { describeError } from "@/features/settings/messages";
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
  // Tres simbolos DISTINTOS, no dos colores sobre el mismo tic. Un «listo» y
  // un «con avisos» que solo se diferencian en ambar contra esmeralda son la
  // misma casilla para quien no distingue esos dos colores.
  const situacion = !estado.completo
    ? { simbolo: "!", texto: "incompleto", clase: "text-red-700 ring-red-300 bg-red-50" }
    : avisos > 0
      ? { simbolo: "▲", texto: "con avisos", clase: "text-amber-800 ring-amber-300 bg-amber-50" }
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
  // El estado REAL de los guardados de ESTA cotización: escrituras en vuelo,
  // errores que nadie ha resuelto y borradores tecleados sin enviar. Protege la
  // recarga y el cierre mientras haya cualquiera de los tres.
  const guardado = useEstadoDeGuardado(quotationId);

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

  // Esperar a las cinco sirve SOLO para decidir a qué paso llevar a quien abre
  // la ficha sin decirlo: esa decisión necesita saber cuál falta, y con cuatro
  // de cinco mandaría a la gente al paso equivocado.
  //
  // Lo que NO se hace es retener la pantalla entera hasta entonces. Cada panel
  // resuelve su propia carga, y bloquear el flujo por la consulta más lenta
  // dejaría mirando una ruedita para ver un paso cuyos datos ya estaban. Que un
  // paso sin leer no se declare completo lo garantiza `pasos.ts`, no esta
  // espera.
  const cargando =
    cotizacion.isPending ||
    productos.isPending ||
    manoDeObra.isPending ||
    quema.isPending ||
    precio.isPending;

  // Sin paso en la URL se lleva al primero que falte, y se hace UNA vez, con
  // `replace` para no dejar basura en el historial. Derivarlo en cada render
  // era peor que inútil: al elegir el cliente, el paso uno pasaba a completo y
  // la pantalla saltaba sola al dos mientras la persona seguía mirando el uno.
  useEffect(() => {
    if (paso !== null || cargando) return;
    navigate(`/cotizador-v2/${quotationId}/${primerPasoIncompleto(estados)}`, { replace: true });
    // `estados` se recalcula en cada render; la dependencia real es haber
    // terminado de cargar, que es cuando ese cálculo significa algo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, cargando, quotationId, navigate]);

  // Sin paso en la URL no hay nada que pintar todavía: elegir uno aquí sería
  // decidir por cuenta propia, y la redirección de arriba está a punto de
  // decirlo. Con paso, se pinta ya.
  if (paso === null) return <Spinner className="size-5" label="Abriendo la cotización..." />;
  const actual: PasoId = paso;

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

      {/* Un guardado rechazado se avisa en TODOS los pasos, no solo en el panel
          que lo lanzó: si ya se ha cambiado de paso, ese panel no existe y el
          error se habría perdido con él. Se queda hasta que el mismo dato se
          guarde con éxito o el usuario lo descarte a sabiendas. */}
      {guardado.fallidos.length > 0 ? (
        <div
          data-testid="guardados-fallidos"
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-4 text-xs text-red-800"
        >
          <p className="font-semibold">
            {guardado.fallidos.length === 1
              ? "Un cambio NO se guardó."
              : `${guardado.fallidos.length} cambios NO se guardaron.`}{" "}
            Lo que ve en pantalla puede no ser lo que hay en el servidor.
          </p>
          <ul className="mt-2 space-y-2">
            {guardado.fallidos.map((fallo) => {
              const destino = DESTINO_DE_GUARDADO[fallo.tipo];
              return (
                <li key={fallo.firma} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    No se pudo guardar <strong>{destino?.que ?? "un cambio"}</strong>:{" "}
                    {describeError(fallo.error)}
                  </span>
                  {destino ? (
                    <button
                      type="button"
                      onClick={() => irAPaso(destino.paso)}
                      className="font-semibold underline underline-offset-2"
                    >
                      Ir a corregirlo
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => guardado.descartar(fallo.firma)}
                    className="text-red-700 underline underline-offset-2"
                  >
                    Descartar este cambio
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Mientras algo sigue llegando no se opina: un paso sin leer figura como
          incompleto —que es la verdad— pero anunciar «no se pudo leer» sobre
          una consulta que aún está en vuelo sería una alarma falsa. */}
      {!cargando && estadoActual && estadoActual.senales.length > 0 ? (
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
        {/* No hay botón de «guardar borrador»: cada campo guarda al salir de él.
            Lo que sí hay es el ESTADO de esos guardados, porque «se guarda solo»
            sin distinguir pendiente de hecho es lo que invita a recargar a mitad. */}
        <p
          data-testid="estado-guardado"
          role="status"
          aria-live="polite"
          className={[
            "text-[11px]",
            guardado.fallidos.length > 0
              ? "font-semibold text-red-700"
              : guardado.hayRiesgo
                ? "font-medium text-amber-700"
                : "text-zinc-500",
          ].join(" ")}
        >
          {/* Por orden de gravedad: un rechazo manda sobre un guardado en
              curso, y este sobre un borrador que aún no ha salido. «Guardados»
              solo cuando no queda NADA de lo anterior. */}
          {guardado.fallidos.length > 0
            ? "Hay cambios que no se guardaron. Revíselos antes de salir."
            : guardado.enVuelo > 0
              ? "Guardando cambios… no cierre ni recargue la página."
              : guardado.borradores > 0
                ? "Hay cambios sin guardar: se guardan al salir del campo."
                : "Todos los cambios guardados."}
        </p>
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
