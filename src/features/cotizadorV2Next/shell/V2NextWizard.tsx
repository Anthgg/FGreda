import { useEffect, useId, useRef, type ComponentType } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
import { PrimaryButton, SecondaryButton } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/features/masters/MasterTable";
import { V2CicloDeVida } from "@/features/cotizadorV2/V2CicloDeVida";
import {
  PASOS,
  evaluarPasos,
  type DatosDelFlujo,
  type PasoId,
} from "@/features/cotizadorV2/pasos";
import { useEstadoDeGuardado } from "@/features/cotizadorV2/useEstadoDeGuardado";
import { useV2Quotation } from "@/features/cotizadorV2/useQuoterV2";
import { useV2Firing } from "@/features/cotizadorV2/useQuoterV2Firing";
import { useV2Labor } from "@/features/cotizadorV2/useQuoterV2Labor";
import { useV2ConfirmationPreview } from "@/features/cotizadorV2/useQuoterV2Lifecycle";
import { useV2QuotationProducts } from "@/features/cotizadorV2/useQuoterV2Materials";
import { useV2Pricing } from "@/features/cotizadorV2/useQuoterV2Pricing";
import {
  ETIQUETA_DE_PASO,
  estadoVisualDePasos,
  primerPasoPendiente,
  type PasoDelAsistenteProps,
} from "@/features/cotizadorV2Next/shell/pasosDelAsistente";
import { V2PendingList } from "@/features/cotizadorV2Next/shell/V2PendingList";
import { V2QuotationHeader } from "@/features/cotizadorV2Next/shell/V2QuotationHeader";
import { V2QuotationSummaryRail } from "@/features/cotizadorV2Next/shell/V2QuotationSummaryRail";
import { V2FailedSaves, V2SaveStatus } from "@/features/cotizadorV2Next/shell/V2SaveStatus";
import { V2StepNav } from "@/features/cotizadorV2Next/shell/V2StepNav";
import { V2NextClientStep } from "@/features/cotizadorV2Next/steps/V2NextClientStep";
import { V2NextKilnStep } from "@/features/cotizadorV2Next/steps/V2NextKilnStep";
import { V2NextLaborStep } from "@/features/cotizadorV2Next/steps/V2NextLaborStep";
import { V2NextMaterialsStep } from "@/features/cotizadorV2Next/steps/V2NextMaterialsStep";
import { V2NextPricingStep } from "@/features/cotizadorV2Next/steps/V2NextPricingStep";
import { V2NextProductsStep } from "@/features/cotizadorV2Next/steps/V2NextProductsStep";
import { V2NextReviewStep } from "@/features/cotizadorV2Next/steps/V2NextReviewStep";
import type { V2DuplicateWarning, V2Quotation } from "@/types/quoterV2";

/**
 * El shell del Cotizador V2 rediseñado. Fase 010O.3.
 *
 * Tres zonas —pasos, contenido y resumen— que se reacomodan con una consulta
 * de CONTENEDOR y no de ventana: el ancho útil depende de si el menú lateral
 * está plegado (72 px) o desplegado (256 px), y la ventana no lo sabe.
 *
 * - contenedor ≥ 1120 px: `216px | contenido | 290px`, pasos y resumen fijos al
 *   desplazar;
 * - 760–1119 px: `200px | contenido`, y el resumen debajo a lo ancho;
 * - menos: una columna, pasos en horizontal y el resumen en una línea.
 *
 * Nada de pie fijo, ni desplazamientos que asuman el ancho del menú, ni un
 * segundo scroll dentro de la página: el único contenedor que desplaza es el
 * `<main>` del AppShell.
 *
 * ## Navegar no espera a guardar
 *
 * Cada campo guarda al salir de él, y salir ocurre antes del clic en otro
 * paso. Retener la navegación hasta que no haya riesgo dejaba a la persona
 * encerrada para siempre si un guardado fallaba —el riesgo no bajaba nunca— y
 * sin forma de ir al paso donde se arregla. Un fallo se avisa arriba, en todos
 * los pasos, con «Ir a corregirlo» y «Descartar este cambio».
 *
 * ## El paso vive en la URL
 *
 * Con los mismos identificadores que `/cotizador-v2` (`cliente`, `productos`…),
 * para que el corte de ruta no rompa ningún enlace. Sin paso, se lleva UNA vez
 * al primero que falte; una cotización que ya no es borrador se abre en
 * «Revisar y emitir», donde está su documento.
 *
 * El contenido de cada paso vive en su propio archivo de `steps/` y recibe
 * `PasoDelAsistenteProps`. En 010O.3 cada uno pinta el panel del asistente
 * anterior; reescribir un paso no toca este archivo.
 */

const PASO_COMPONENTE: Record<PasoId, ComponentType<PasoDelAsistenteProps>> = {
  cliente: V2NextClientStep,
  productos: V2NextProductsStep,
  materiales: V2NextMaterialsStep,
  "mano-de-obra": V2NextLaborStep,
  quema: V2NextKilnStep,
  precio: V2NextPricingStep,
  resumen: V2NextReviewStep,
};

/** Lo que la duplicación deja en el estado de la navegación al llegar aquí. */
interface EstadoDeLlegada {
  avisosDeDuplicacion?: V2DuplicateWarning[];
  duplicacionCreada?: boolean;
}

export function V2NextWizard({
  quotationId,
  paso,
  rutaBase,
}: {
  quotationId: number;
  /** El paso de la URL, o `null` si no dice uno válido. */
  paso: PasoId | null;
  /** Dónde vive el asistente: `/cotizador-v2-next` hasta el corte. */
  rutaBase: string;
}) {
  const consulta = useV2Quotation(quotationId);

  if (consulta.isPending) return <Spinner className="size-5" label="Cargando cotización…" />;
  if (consulta.isError) {
    return (
      <EmptyState
        message={
          consulta.error instanceof ApiError && consulta.error.status === 404
            ? "Esa cotización V2 no existe. Comprueba el enlace."
            : "No se pudo cargar la cotización V2."
        }
      />
    );
  }
  return (
    <Asistente
      cotizacion={consulta.data}
      quotationId={quotationId}
      paso={paso}
      rutaBase={rutaBase}
    />
  );
}

function Asistente({
  cotizacion,
  quotationId,
  paso,
  rutaBase,
}: {
  cotizacion: V2Quotation;
  quotationId: number;
  paso: PasoId | null;
  rutaBase: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const llegada = (location.state ?? null) as EstadoDeLlegada | null;
  const guardado = useEstadoDeGuardado(quotationId);
  const tituloDelPaso = useId();

  // Las consultas que juzgan los pasos. Los paneles piden además las suyas,
  // pero TanStack las comparte por clave: esto no duplica ni una petición.
  const productos = useV2QuotationProducts(quotationId);
  const manoDeObra = useV2Labor(quotationId);
  const quema = useV2Firing(quotationId);
  const precio = useV2Pricing(quotationId);
  // Los bloqueos del backend: la autoridad sobre lo que impide emitir. Se
  // refresca tras cada guardado (`invalidarCotizacion`) sin que nadie lo espere.
  const resumenDeEmision = useV2ConfirmationPreview(quotationId, true);

  const datos: DatosDelFlujo = {
    cotizacion,
    productos: productos.data,
    manoDeObra: manoDeObra.data,
    quema: quema.data,
    precio: precio.data,
  };
  const estados = evaluarPasos(datos);
  const cargando =
    productos.isPending || manoDeObra.isPending || quema.isPending || precio.isPending;
  const bloqueos = resumenDeEmision.data?.blockers;
  const visual = estadoVisualDePasos(estados, bloqueos, cargando);
  const editable = cotizacion.status === "DRAFT";

  const irAPaso = (destino: PasoId) => navigate(`${rutaBase}/${quotationId}/${destino}`);

  // Sin paso en la URL se lleva a uno, UNA vez y con `replace`. Espera a los
  // bloqueos porque deciden cuál falta; derivarlo en cada render movería la
  // pantalla sola al completar un paso mientras alguien lo sigue mirando.
  const listoParaDecidir = !cargando && !resumenDeEmision.isPending;
  const destinoInicial = editable ? primerPasoPendiente(visual) : "resumen";
  useEffect(() => {
    if (paso !== null || !listoParaDecidir) return;
    navigate(`${rutaBase}/${quotationId}/${destinoInicial}`, { replace: true });
  }, [paso, listoParaDecidir, destinoInicial, quotationId, rutaBase, navigate]);

  // Al cambiar de paso, el foco va al título del paso nuevo —quien usa lector
  // de pantalla sabe dónde está— y, si el asistente quedó arriba fuera de la
  // vista, se vuelve a su inicio. La primera llegada no roba el foco.
  const raiz = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const pasoAnterior = useRef(paso);
  useEffect(() => {
    if (pasoAnterior.current === paso) return;
    const habia = pasoAnterior.current;
    pasoAnterior.current = paso;
    if (habia === null) return;
    titulo.current?.focus({ preventScroll: true });
    const nodo = raiz.current;
    if (nodo && nodo.getBoundingClientRect().top < 0) nodo.scrollIntoView?.({ block: "start" });
  }, [paso]);

  const encabezado = (
    <V2QuotationHeader
      titulo={cotizacion.name ?? cotizacion.customer_name ?? "Nueva cotización"}
      codigo={cotizacion.code}
      rutaListado={rutaBase}
    >
      <V2CicloDeVida
        cotizacion={cotizacion}
        avisosDeDuplicacion={llegada?.avisosDeDuplicacion}
        duplicacionCreada={llegada?.duplicacionCreada}
      />
    </V2QuotationHeader>
  );

  if (paso === null) {
    return (
      <div className="space-y-5">
        {encabezado}
        <Spinner className="size-5" label="Abriendo la cotización…" />
      </div>
    );
  }

  const indice = PASOS.findIndex((item) => item.id === paso);
  const anterior = indice > 0 ? PASOS[indice - 1] : undefined;
  const siguiente = indice < PASOS.length - 1 ? PASOS[indice + 1] : undefined;
  const senales = estados[indice]?.senales ?? [];
  const Paso = PASO_COMPONENTE[paso];
  const avisos = visual
    .filter((uno) => uno.id !== "resumen")
    .reduce((total, uno) => total + uno.avisos, 0);

  return (
    <div ref={raiz} data-testid="v2next-asistente" className="@container min-w-0 space-y-5">
      {encabezado}

      <V2FailedSaves guardado={guardado} irAPaso={irAPaso} />

      <div
        data-testid="v2next-rejilla"
        className="grid min-w-0 grid-cols-1 items-start gap-5 @min-[760px]:grid-cols-[200px_minmax(0,1fr)] @min-[1120px]:grid-cols-[216px_minmax(0,1fr)_290px]"
      >
        <V2StepNav
          pasos={visual}
          actual={paso}
          onIr={irAPaso}
          className="@min-[760px]:sticky @min-[760px]:top-0 @min-[760px]:z-10"
        />

        <section aria-labelledby={tituloDelPaso} className="min-w-0 space-y-4">
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-wider text-zinc-500">
              Paso {indice + 1} de {PASOS.length}
            </p>
            <h2
              id={tituloDelPaso}
              ref={titulo}
              tabIndex={-1}
              className="mt-0.5 text-lg font-bold tracking-tight text-zinc-950 outline-none"
            >
              {ETIQUETA_DE_PASO[paso].titulo}
            </h2>
          </div>

          {/* Mientras algo sigue llegando no se opina: anunciar «no se pudo
              leer» sobre una consulta en vuelo sería una alarma falsa. */}
          {!cargando && senales.length > 0 ? (
            <ul data-testid="v2next-senales-del-paso" className="space-y-1.5">
              {senales.map((senal, posicion) => (
                <li
                  key={`${senal.severidad}-${posicion}`}
                  className={[
                    "rounded-xl border px-3 py-2 text-xs",
                    senal.severidad === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : senal.severidad === "aviso"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-black/[0.06] bg-white/60 text-zinc-700",
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

          <Paso
            quotationId={quotationId}
            canEdit={editable}
            datos={datos}
            estados={estados}
            irAPaso={irAPaso}
          />

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4">
            <div className="min-w-0">
              {anterior ? (
                <SecondaryButton type="button" onClick={() => irAPaso(anterior.id)}>
                  <span aria-hidden="true">‹</span>&nbsp;{ETIQUETA_DE_PASO[anterior.id].titulo}
                </SecondaryButton>
              ) : null}
            </div>
            {editable ? <V2SaveStatus guardado={guardado} /> : null}
            <div className="min-w-0">
              {siguiente ? (
                <PrimaryButton type="button" onClick={() => irAPaso(siguiente.id)}>
                  Siguiente: {ETIQUETA_DE_PASO[siguiente.id].titulo}
                </PrimaryButton>
              ) : null}
            </div>
          </footer>
        </section>

        <V2QuotationSummaryRail
          cotizacion={cotizacion}
          precio={precio.data}
          precioCargando={precio.isPending}
          precioError={precio.isError}
          lineas={productos.data?.items}
          faltas={editable ? bloqueos?.length : 0}
          className="@min-[760px]:col-span-full @min-[1120px]:sticky @min-[1120px]:top-0 @min-[1120px]:col-span-1"
          pendientes={
            <V2PendingList
              bloqueos={bloqueos}
              cargando={resumenDeEmision.isPending}
              error={resumenDeEmision.isError}
              editable={editable}
              avisos={avisos}
              lineas={productos.data?.items ?? []}
              irAPaso={irAPaso}
            />
          }
        />
      </div>
    </div>
  );
}
