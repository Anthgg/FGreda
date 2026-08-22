import { Route, Routes } from "react-router-dom";

import { LoginPage } from "@/features/auth/LoginPage";
import { ProtectedRoute, PublicOnlyRoute } from "@/features/auth/ProtectedRoute";
import { ImportsPage } from "@/features/imports/ImportsPage";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { PartnersPage } from "@/features/masters/PartnersPage";
import { ProductsPage } from "@/features/masters/ProductsPage";
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
          <Route path="configuracion" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
