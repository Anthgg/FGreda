import { Route, Routes } from "react-router-dom";

import { LoginPage } from "@/features/auth/LoginPage";
import { ProtectedRoute, PublicOnlyRoute } from "@/features/auth/ProtectedRoute";
import { CotizadorPage } from "@/features/cotizador/CotizadorPage";
import { DetalleQuemaPage } from "@/features/firings/DetalleQuemaPage";
import { EditarQuemaPage } from "@/features/firings/EditarQuemaPage";
import { FiringsPage } from "@/features/firings/FiringsPage";
import { NuevaQuemaPage } from "@/features/firings/NuevaQuemaPage";
import { ImportsPage } from "@/features/imports/ImportsPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { PartnersPage } from "@/features/masters/PartnersPage";
import { ProductionOrderDetailPage } from "@/features/production/ProductionOrderDetailPage";
import { ProductionOrderScanPage } from "@/features/production/ProductionOrderScanPage";
import { ProductionOrdersPage } from "@/features/production/ProductionOrdersPage";
import { PrototypeDetailPage } from "@/features/prototypes/PrototypeDetailPage";
import { PrototypeFormPage } from "@/features/prototypes/PrototypeFormPage";
import { PrototypesPage } from "@/features/prototypes/PrototypesPage";
import { ProductsPage } from "@/features/masters/ProductsPage";
import { DetalleCotizacionPage } from "@/features/quotations/DetalleCotizacionPage";
import { EditarCotizacionPage } from "@/features/quotations/EditarCotizacionPage";
import { NuevaCotizacionPage } from "@/features/quotations/NuevaCotizacionPage";
import { QuotationsPage } from "@/features/quotations/QuotationsPage";
import { RecipesPage } from "@/features/recipes/RecipesPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { PublicTrackingPage } from "@/features/tracking/PublicTrackingPage";
import { TrackingScanPage } from "@/features/tracking/TrackingScanPage";
import { AppShell } from "@/layouts/AppShell";
import { HomePage } from "@/routes/HomePage";
import { NotFoundPage } from "@/routes/NotFoundPage";

/**
 * Mapa de rutas.
 *
 * Casi todo vive detras de `ProtectedRoute`, que consulta al backend antes de
 * renderizar. Las dos excepciones son deliberadas: el login y el SEGUIMIENTO
 * PUBLICO de produccion (Fase 009I.1), al que se llega escaneando el QR de una
 * hoja de taller.
 *
 * El seguimiento esta fuera de la sesion porque quien escanea normalmente no
 * tiene cuenta —quien lleva la pieza al horno, quien pregunta por su encargo—.
 * Hasta 009J acababa en el login y el QR impreso no servia para nada.
 *
 * Que sea publico no lo hace inseguro: la autoridad sigue siendo el backend,
 * que bajo `/api/v1/tracking` no expone ni una escritura ni un dato interno.
 * Estas dos rutas no pueden mutar nada porque no hay nada que llamar.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Publicas, sin sesion. Fuera del AppShell a proposito: no hay menu, ni
          inventario, ni nombre de usuario que ensenar a quien solo quiere
          saber como va su pieza.

          `/seguimiento/:token` va ANTES que `/seguimiento`: React Router
          resuelve por especificidad, pero el orden escrito deja claro que la
          primera existe para durar un instante y reemplazarse por la segunda,
          que es donde el token ya no esta en la direccion. */}
      <Route path="/seguimiento/:token" element={<TrackingScanPage />} />
      <Route path="/seguimiento" element={<PublicTrackingPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="productos" element={<ProductsPage />} />
          <Route path="terceros" element={<PartnersPage />} />
          <Route path="inventario" element={<InventoryPage />} />
          <Route path="importaciones" element={<ImportsPage />} />
          <Route path="recetas" element={<RecipesPage />} />
          <Route path="quemas" element={<FiringsPage />} />
          <Route path="quemas/nueva" element={<NuevaQuemaPage />} />
          <Route path="quemas/:id" element={<DetalleQuemaPage />} />
          <Route path="quemas/:id/editar" element={<EditarQuemaPage />} />
          <Route path="cotizaciones" element={<QuotationsPage />} />
          <Route path="cotizaciones/nueva" element={<NuevaCotizacionPage />} />
          <Route path="cotizaciones/:id" element={<DetalleCotizacionPage />} />
          <Route path="cotizaciones/:id/editar" element={<EditarCotizacionPage />} />
          <Route path="produccion" element={<ProductionOrdersPage />} />
          {/* Antes que "produccion/:id": una ruta con parametro se traga
              "produccion/scan/xxx" y el detalle recibiria "scan" como id. */}
          <Route path="produccion/scan/:token" element={<ProductionOrderScanPage />} />
          <Route path="produccion/:id" element={<ProductionOrderDetailPage />} />
          <Route path="prototipos" element={<PrototypesPage />} />
          <Route path="prototipos/nuevo" element={<PrototypeFormPage />} />
          <Route path="prototipos/:id" element={<PrototypeDetailPage section="resumen" />} />
          <Route path="prototipos/:id/editar" element={<PrototypeDetailPage section="editar" />} />
          <Route path="prototipos/:id/materiales" element={<PrototypeDetailPage section="materiales" />} />
          <Route path="prototipos/:id/operacion" element={<PrototypeDetailPage section="operacion" />} />
          <Route path="prototipos/:id/evaluacion" element={<PrototypeDetailPage section="evaluacion" />} />
          <Route path="prototipos/:id/iteraciones" element={<PrototypeDetailPage section="iteraciones" />} />
          <Route path="cotizador/nuevo" element={<CotizadorPage />} />
          <Route path="cotizador/:id" element={<CotizadorPage />} />
          <Route path="configuracion" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
