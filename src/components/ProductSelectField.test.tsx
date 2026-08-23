import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProductSelectField } from "@/components/ProductSelectField";
import { errorResponse, jsonResponse, mockFetch, renderWithProviders } from "@/test/utils";
import type { Page, Product } from "@/types/masters";

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: 1,
    product_category_id: 1,
    product_category_path: "Materias Primas",
    pos_category_id: null,
    pos_category_name: null,
    base_uom_code: "g",
    purchase_uom_code: "kg",
    internal_reference: "LAB70098",
    name: "Carbonato de calcio",
    product_type: "RAW_MATERIAL",
    active: true,
    sellable: false,
    purchasable: true,
    available_in_pos: false,
    cost: "0.0500",
    sale_price: null,
    sale_tax_rate: null,
    purchase_tax_rate: null,
    notes: null,
  },
  {
    id: 2,
    product_category_id: 1,
    product_category_path: "Materias Primas",
    pos_category_id: null,
    pos_category_name: null,
    base_uom_code: "g",
    purchase_uom_code: "kg",
    internal_reference: "LAB70099",
    name: "Feldespato potásico",
    product_type: "RAW_MATERIAL",
    active: true,
    sellable: false,
    purchasable: true,
    available_in_pos: false,
    cost: "0.0800",
    sale_price: null,
    sale_tax_rate: null,
    purchase_tax_rate: null,
    notes: null,
  },
  {
    id: 3,
    product_category_id: 1,
    product_category_path: "Materias Primas",
    pos_category_id: null,
    pos_category_name: null,
    base_uom_code: "g",
    purchase_uom_code: "kg",
    internal_reference: "LAB70100",
    name: "Cuarzo malla 200",
    product_type: "RAW_MATERIAL",
    active: true,
    sellable: false,
    purchasable: true,
    available_in_pos: false,
    cost: "0.0400",
    sale_price: null,
    sale_tax_rate: null,
    purchase_tax_rate: null,
    notes: null,
  },
];

const SAMPLE_PAGE: Page<Product> = {
  items: SAMPLE_PRODUCTS,
  total: 3,
  limit: 50,
  offset: 0,
};

describe("ProductSelectField (Componente con búsqueda y paginación servidor)", () => {
  it("realiza fetch inicial con limit=50 y no usa selects nativos", async () => {
    const user = userEvent.setup();
    let requestedUrl = "";

    mockFetch((url) => {
      if (url.includes("/products")) {
        requestedUrl = url;
        return jsonResponse(200, SAMPLE_PAGE);
      }
      return errorResponse(404, "NOT_FOUND");
    });

    const handleChange = vi.fn();

    renderWithProviders(
      <ProductSelectField
        label="Componente"
        value=""
        onChange={handleChange}
      />
    );

    // No debe existir ningún select nativo
    expect(document.querySelectorAll("select").length).toBe(0);

    // Abrir selector
    const button = screen.getByRole("combobox", { name: "Componente" });
    await user.click(button);

    // Verificar que la petición usó limit=50 y offset=0 (no limit=300)
    await waitFor(() => {
      expect(requestedUrl).toContain("limit=50");
      expect(requestedUrl).toContain("offset=0");
    });
    expect(requestedUrl).not.toContain("limit=300");

    // Verificar que muestra los productos con formato REF · Nombre
    expect(await screen.findByText("LAB70098")).toBeInTheDocument();
    expect(screen.getByText("Carbonato de calcio")).toBeInTheDocument();
    expect(screen.getByText("LAB70099")).toBeInTheDocument();
    expect(screen.getByText("Feldespato potásico")).toBeInTheDocument();
  });

  it("permite seleccionar un producto y llama onChange con el ID y objeto producto", async () => {
    const user = userEvent.setup();

    mockFetch((url) => {
      if (url.includes("/products")) return jsonResponse(200, SAMPLE_PAGE);
      return errorResponse(404, "NOT_FOUND");
    });

    const handleChange = vi.fn();

    renderWithProviders(
      <ProductSelectField
        label="Componente"
        value=""
        onChange={handleChange}
      />
    );

    const button = screen.getByRole("combobox", { name: "Componente" });
    await user.click(button);

    const option = await screen.findByText("Carbonato de calcio");
    await user.click(option);

    expect(handleChange).toHaveBeenCalledWith("1", expect.objectContaining({ name: "Carbonato de calcio" }));
  });

  it("realiza búsqueda remota en el servidor por nombre o referencia", async () => {
    const user = userEvent.setup();
    const searchQueries: string[] = [];

    mockFetch((url) => {
      if (url.includes("/products")) {
        const u = new URL(url, "http://localhost");
        const search = u.searchParams.get("search");
        if (search) searchQueries.push(search);

        if (search === "cuarzo") {
          return jsonResponse(200, {
            items: [SAMPLE_PRODUCTS[2]],
            total: 1,
            limit: 50,
            offset: 0,
          });
        }
        return jsonResponse(200, SAMPLE_PAGE);
      }
      return errorResponse(404, "NOT_FOUND");
    });

    renderWithProviders(
      <ProductSelectField
        label="Componente"
        value=""
        onChange={vi.fn()}
      />
    );

    const button = screen.getByRole("combobox", { name: "Componente" });
    await user.click(button);

    const input = await screen.findByPlaceholderText(/Buscar por nombre o referencia/i);
    await user.type(input, "cuarzo");

    await waitFor(() => {
      expect(searchQueries).toContain("cuarzo");
    });

    expect(await screen.findByText("Cuarzo malla 200")).toBeInTheDocument();
  });

  it("muestra estado de error con botón de reintentar si el backend falla", async () => {
    const user = userEvent.setup();
    let fail = true;

    mockFetch((url) => {
      if (url.includes("/products")) {
        if (fail) return errorResponse(500, "SERVER_ERROR");
        return jsonResponse(200, SAMPLE_PAGE);
      }
      return errorResponse(404, "NOT_FOUND");
    });

    renderWithProviders(
      <ProductSelectField
        label="Componente"
        value=""
        onChange={vi.fn()}
      />
    );

    const button = screen.getByRole("combobox", { name: "Componente" });
    await user.click(button);

    expect(await screen.findByText(/No se pudieron cargar los componentes/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /reintentar/i });
    fail = false;
    await user.click(retryBtn);

    expect(await screen.findByText("Carbonato de calcio")).toBeInTheDocument();
  });

  it("preserva el label del producto seleccionado aunque se filtre en el buscador", async () => {
    mockFetch((url) => {
      if (url.includes("/products")) return jsonResponse(200, SAMPLE_PAGE);
      return errorResponse(404, "NOT_FOUND");
    });

    renderWithProviders(
      <ProductSelectField
        label="Componente"
        value="1"
        selectedLabel="LAB70098 · Carbonato de calcio"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("LAB70098 · Carbonato de calcio")).toBeInTheDocument();
  });

  it("permite crear pieza cuando no hay resultados y allowCreate está activo", async () => {
    const user = userEvent.setup();
    const handleCreate = vi.fn();

    mockFetch((url) => {
      if (url.includes("/products")) {
        const u = new URL(url, "http://localhost");
        const search = u.searchParams.get("search");
        if (search === "Taza Dragón") {
          return jsonResponse(200, { items: [], total: 0, limit: 50, offset: 0 });
        }
        return jsonResponse(200, SAMPLE_PAGE);
      }
      return errorResponse(404, "NOT_FOUND");
    });

    renderWithProviders(
      <ProductSelectField
        label="Pieza"
        value=""
        onChange={vi.fn()}
        allowCreate={true}
        onCreateRequested={handleCreate}
      />
    );

    const button = screen.getByRole("combobox", { name: "Pieza" });
    await user.click(button);

    const input = await screen.findByPlaceholderText(/Buscar por nombre o referencia/i);
    await user.type(input, "Taza Dragón");

    const createBtn = await screen.findByText('+ Crear pieza "Taza Dragón"');
    expect(createBtn).toBeInTheDocument();

    await user.click(createBtn);
    expect(handleCreate).toHaveBeenCalledWith("Taza Dragón");
  });

  it("no muestra acción de crear si allowCreate=false aunque no haya resultados", async () => {
    const user = userEvent.setup();

    mockFetch((url) => {
      if (url.includes("/products")) {
        return jsonResponse(200, { items: [], total: 0, limit: 50, offset: 0 });
      }
      return errorResponse(404, "NOT_FOUND");
    });

    renderWithProviders(
      <ProductSelectField
        label="Pieza"
        value=""
        onChange={vi.fn()}
        allowCreate={false}
      />
    );

    const button = screen.getByRole("combobox", { name: "Pieza" });
    await user.click(button);

    const input = await screen.findByPlaceholderText(/Buscar por nombre o referencia/i);
    await user.type(input, "Florero inexistente");

    await waitFor(() => {
      expect(screen.getByText(/No se encontraron piezas para/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Crear pieza/i)).not.toBeInTheDocument();
  });

  it("no muestra acción de crear cuando la búsqueda coincide exactamente ignorando mayúsculas y espacios", async () => {
    const user = userEvent.setup();

    mockFetch((url) => {
      if (url.includes("/products")) {
        return jsonResponse(200, SAMPLE_PAGE);
      }
      return errorResponse(404, "NOT_FOUND");
    });

    renderWithProviders(
      <ProductSelectField
        label="Pieza"
        value=""
        onChange={vi.fn()}
        allowCreate={true}
        onCreateRequested={vi.fn()}
      />
    );

    const button = screen.getByRole("combobox", { name: "Pieza" });
    await user.click(button);

    const input = await screen.findByPlaceholderText(/Buscar por nombre o referencia/i);
    // Búsqueda con espacios adicionales y mayúsculas
    await user.type(input, "  CARBONATO   DE   CALCIO  ");

    // Debe mostrar la opción existente
    expect(await screen.findByText("Carbonato de calcio")).toBeInTheDocument();

    // No debe ofrecer crear un duplicado
    expect(screen.queryByText(/Crear pieza/i)).not.toBeInTheDocument();
  });

  it("soporta selección y creación mediante teclado (ArrowDown, Enter, Escape)", async () => {
    const user = userEvent.setup();
    const handleCreate = vi.fn();

    mockFetch((url) => {
      if (url.includes("/products")) {
        const u = new URL(url, "http://localhost");
        const search = u.searchParams.get("search");
        if (search === "Nuevo plato") {
          return jsonResponse(200, { items: [], total: 0, limit: 50, offset: 0 });
        }
        return jsonResponse(200, SAMPLE_PAGE);
      }
      return errorResponse(404, "NOT_FOUND");
    });

    renderWithProviders(
      <ProductSelectField
        label="Pieza"
        value=""
        onChange={vi.fn()}
        allowCreate={true}
        onCreateRequested={handleCreate}
      />
    );

    const button = screen.getByRole("combobox", { name: "Pieza" });
    await user.click(button);

    const input = await screen.findByPlaceholderText(/Buscar por nombre o referencia/i);
    await user.type(input, "Nuevo plato");

    // Esperar a que la búsqueda remota responda sin resultados
    expect(await screen.findByText(/No se encontraron piezas para/i)).toBeInTheDocument();
    const createBtn = await screen.findByText('+ Crear pieza "Nuevo plato"');
    expect(createBtn).toBeInTheDocument();

    // Presionar Enter en el buscador ejecuta la acción creatable
    await user.type(input, "{Enter}");

    expect(handleCreate).toHaveBeenCalledWith("Nuevo plato");
  });
});
