/**
 * Maestro de productos.
 *
 * La busqueda y los filtros los resuelve el backend: la tabla nunca descarga
 * el maestro entero para filtrarlo en el navegador.
 */

import { useState } from "react";

import { PrimaryButton, SecondaryButton, SelectField } from "@/components/form";
import { Spinner } from "@/components/Spinner";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { useSession } from "@/features/auth/useSession";
import { describeError } from "@/features/settings/messages";
import {
  Badge,
  EmptyState,
  MasterHeader,
  Pagination,
  Panel,
  SearchInput,
  TableWrapper,
  Td,
  Th,
  Toolbar,
} from "@/features/masters/MasterTable";
import { PRODUCT_TYPE_LABELS } from "@/features/masters/labels";
import { ProductForm } from "@/features/masters/ProductForm";
import {
  useCreateProduct,
  usePosCategories,
  useProductCategories,
  useProducts,
  useUnits,
  useUpdateProduct,
} from "@/features/masters/useMasters";
import type { Product, ProductInput, ProductType } from "@/types/masters";

const PAGE_SIZE = 25;

/** Recorta la cola de ceros sin tocar el valor: 0.016906843137 sigue entero. */
function formatDecimal(value: string | null): string {
  if (value === null || value === "") return "—";
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}

export function ProductsPage() {
  const { data: user } = useSession();
  const isAdmin = user?.role === "ADMIN";

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productType, setProductType] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Product | null | "new">(null);

  const categories = useProductCategories();
  const posCategories = usePosCategories();
  const units = useUnits();
  const products = useProducts({
    ...(search.trim() !== "" ? { search: search.trim() } : {}),
    ...(categoryId !== "" ? { category_id: Number(categoryId) } : {}),
    ...(productType !== "" ? { product_type: productType as ProductType } : {}),
    limit: PAGE_SIZE,
    offset,
  });

  const create = useCreateProduct();
  const update = useUpdateProduct();

  const failure = products.error ?? categories.error;

  const handleSubmit = (payload: ProductInput) => {
    if (editing === "new" || editing === null) {
      create.mutate(payload, { onSuccess: () => setEditing(null) });
    } else {
      update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) });
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1536px] px-4 py-2 sm:px-6 lg:px-8">
      <MasterHeader
        title={
          <TypewriterTitle
            text="Productos."
            className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl"
          />
        }
        subtitle="Insumos, preparados, productos terminados y servicios del taller."
        actions={
          isAdmin && editing === null ? (
            <PrimaryButton type="button" onClick={() => setEditing("new")}>
              Nuevo producto
            </PrimaryButton>
          ) : null
        }
      />

      <Panel>
        {editing !== null ? (
          <ProductForm
            product={editing === "new" ? null : editing}
            categories={categories.data ?? []}
            posCategories={posCategories.data ?? []}
            units={units.data ?? []}
            disabled={!isAdmin}
            saving={create.isPending || update.isPending}
            error={create.error ?? update.error}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <>
            <Toolbar>
              <SearchInput
                label="Buscar producto"
                placeholder="Nombre o referencia interna"
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setOffset(0);
                }}
              />
              <SelectField
                label="Categoría"
                value={categoryId}
                options={[
                  { value: "", label: "Todas las categorías" },
                  ...(categories.data ?? []).map((item) => ({
                    value: String(item.id),
                    label: item.display_path,
                  })),
                ]}
                onChange={(value) => {
                  setCategoryId(value);
                  setOffset(0);
                }}
                searchPlaceholder="Buscar categoría..."
                className="w-full sm:w-72"
              />
              <SelectField
                label="Tipo"
                value={productType}
                options={[
                  { value: "", label: "Todos los tipos" },
                  ...(Object.keys(PRODUCT_TYPE_LABELS) as ProductType[]).map((value) => ({
                    value,
                    label: PRODUCT_TYPE_LABELS[value],
                  })),
                ]}
                onChange={(value) => {
                  setProductType(value);
                  setOffset(0);
                }}
                className="w-full sm:w-56"
              />
            </Toolbar>

            {products.isPending ? (
              <Spinner label="Cargando productos..." />
            ) : failure ? (
              <p className="py-8 text-center text-sm text-red-600">
                {describeError(failure)}
              </p>
            ) : (products.data?.items.length ?? 0) === 0 ? (
              <EmptyState message="No hay productos que coincidan con la búsqueda." />
            ) : (
              <>
                <TableWrapper>
                  <thead>
                    <tr>
                      <Th>Referencia</Th>
                      <Th>Nombre</Th>
                      <Th>Tipo</Th>
                      <Th>Categoría</Th>
                      <Th>Unidad</Th>
                      <Th align="right">Costo</Th>
                      <Th align="right">Precio</Th>
                      <Th>Estado</Th>
                      {isAdmin ? <Th align="right">Acción</Th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {products.data?.items.map((product) => (
                      <tr key={product.id}>
                        <Td mono>{product.internal_reference}</Td>
                        <Td>{product.name}</Td>
                        <Td muted>{PRODUCT_TYPE_LABELS[product.product_type]}</Td>
                        <Td muted>{product.product_category_path ?? "—"}</Td>
                        <Td muted>{product.base_uom_code ?? "—"}</Td>
                        <Td align="right" mono>
                          {formatDecimal(product.cost)}
                        </Td>
                        <Td align="right" mono>
                          {formatDecimal(product.sale_price)}
                        </Td>
                        <Td>
                          {product.active ? (
                            <Badge tone="positive">Activo</Badge>
                          ) : (
                            <Badge>Inactivo</Badge>
                          )}
                        </Td>
                        {isAdmin ? (
                          <Td align="right">
                            <SecondaryButton onClick={() => setEditing(product)}>
                              Editar
                            </SecondaryButton>
                          </Td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </TableWrapper>
                <Pagination
                  total={products.data?.total ?? 0}
                  limit={PAGE_SIZE}
                  offset={offset}
                  onOffsetChange={setOffset}
                />
              </>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
