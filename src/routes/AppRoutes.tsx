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
import { ProductsPage } from "@/features/masters/ProductsPage";
import { DetalleCotizacionPage } from "@/features/quotations/DetalleCotizacionPage";
import { EditarCotizacionPage } from "@/features/quotations/EditarCotizacionPage";
import { NuevaCotizacionPage } from "@/features/quotations/NuevaCotizacionPage";
import { QuotationsPage } from "@/features/quotations/QuotationsPage";
import { RecipesPage } from "@/features/recipes/RecipesPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { AppShell } from "@/layouts/AppShell";
import { HomePage } from "@/routes/HomePage";
import { NotFoundPage } from "@/routes/NotFoundPage";

/**
 * Mapa de rutas.
 *
 * Todo lo que no sea el login vive detras de `ProtectedRoute`, que consulta al
 * backend antes de renderizar.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

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
          <Route path="cotizador/nuevo" element={<CotizadorPage />} />
          <Route path="cotizador/:id" element={<CotizadorPage />} />
          <Route path="configuracion" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
