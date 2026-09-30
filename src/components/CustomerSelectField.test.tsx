import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CustomerSelectField } from "@/components/CustomerSelectField";
import { errorResponse, jsonResponse, mockFetch, renderWithProviders } from "@/test/utils";
import type { Partner } from "@/types/masters";

const CLIENT: Partner = {
  id: 1,
  name: "Ana Cerámica",
  role: "CLIENT",
  document_type: "DNI",
  document_number: "12345678",
  address: null,
  reference: null,
  ubigeo_code: null,
  district: null,
  province: null,
  department: null,
  country: "Perú",
  email: null,
  mobile: null,
  phone: null,
  active: true,
  notes: null,
};

const BOTH: Partner = {
  ...CLIENT,
  id: 2,
  name: "Taller Mixto",
  role: "BOTH",
  document_number: "20123456789",
};

const SUPPLIER: Partner = {
  ...CLIENT,
  id: 3,
  name: "Proveedor Puro",
  role: "SUPPLIER",
};

function page(items: Partner[]) {
  return { items, total: items.length, limit: 20, offset: 0 };
}

function installPartnerSearch(
  responder: (role: string | null, search: string | null) => Partner[],
) {
  return mockFetch((url) => {
    if (!url.includes("/partners")) return errorResponse(404, "NOT_FOUND");
    const query = new URL(url, "http://localhost").searchParams;
    return jsonResponse(200, page(responder(query.get("role"), query.get("search"))));
  });
}

describe("CustomerSelectField", () => {
  it("consulta CLIENT y BOTH con límite 20 y excluye proveedores puros", async () => {
    const requested: string[] = [];
    mockFetch((url) => {
      if (!url.includes("/partners")) return errorResponse(404, "NOT_FOUND");
      requested.push(url);
      const role = new URL(url, "http://localhost").searchParams.get("role");
      return jsonResponse(200, page(role === "BOTH" ? [BOTH] : [CLIENT, SUPPLIER]));
    });

    renderWithProviders(
      <CustomerSelectField label="Cliente" value={null} onChange={vi.fn()} />,
    );
    await userEvent.setup().click(screen.getByRole("combobox", { name: "Cliente" }));

    expect(await screen.findByRole("option", { name: /Ana Cerámica/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Taller Mixto/ })).toBeInTheDocument();
    expect(screen.queryByText("Proveedor Puro")).not.toBeInTheDocument();
    await waitFor(() => expect(requested).toHaveLength(2));
    for (const url of requested) {
      const query = new URL(url, "http://localhost").searchParams;
      expect(["CLIENT", "BOTH"]).toContain(query.get("role"));
      expect(query.get("limit")).toBe("20");
      expect(query.get("offset")).toBe("0");
    }
  });

  it("espera 300 ms tras dejar de escribir antes de buscar en el servidor", async () => {
    const searches: string[] = [];
    mockFetch((url) => {
      if (!url.includes("/partners")) return errorResponse(404, "NOT_FOUND");
      const query = new URL(url, "http://localhost").searchParams;
      const search = query.get("search") ?? "";
      if (search) searches.push(`${query.get("role")}:${search}`);
      return jsonResponse(200, page([]));
    });

    const user = userEvent.setup();
    renderWithProviders(
      <CustomerSelectField label="Cliente" value={null} onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("combobox", { name: "Cliente" }));
    const search = await screen.findByPlaceholderText(/Buscar por nombre o documento/i);
    await user.type(search, "Lima");

    expect(searches).toEqual([]);
    await waitFor(() => expect(searches).toHaveLength(2), { timeout: 1500 });
    expect(searches).toEqual(["CLIENT:Lima", "BOTH:Lima"]);
  });

  it("incluye en la lista el cliente seleccionado aunque no esté en la página", async () => {
    installPartnerSearch(() => [CLIENT]);
    const user = userEvent.setup();
    renderWithProviders(
      <CustomerSelectField
        label="Cliente"
        value={42}
        selectedLabel="Cerámicas del Sur"
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Cliente" }));
    const selected = await screen.findByRole("option", { name: "Cerámicas del Sur" });
    expect(selected).toHaveAttribute("aria-selected", "true");
  });

  it("muestra loading mientras la API no responde", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    mockFetch(
      (url) =>
        url.includes("/partners")
          ? new Promise<Response>((resolve) => resolvers.push(resolve))
          : errorResponse(404, "NOT_FOUND"),
    );

    const user = userEvent.setup();
    renderWithProviders(
      <CustomerSelectField label="Cliente" value={null} onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("combobox", { name: "Cliente" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Cargando clientes...");

    await act(async () => {
      for (const resolver of resolvers) resolver(jsonResponse(200, page([CLIENT])));
    });
    expect(await screen.findByRole("option", { name: /Ana Cerámica/ })).toBeInTheDocument();
  });

  it("permite reintentar después de un error del servidor", async () => {
    let fail = true;
    mockFetch((url) => {
      if (!url.includes("/partners")) return errorResponse(404, "NOT_FOUND");
      return fail ? errorResponse(500, "SERVER_ERROR") : jsonResponse(200, page([CLIENT]));
    });

    const user = userEvent.setup();
    renderWithProviders(
      <CustomerSelectField label="Cliente" value={null} onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("combobox", { name: "Cliente" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/No se pudieron cargar los clientes/i);

    fail = false;
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("option", { name: /Ana Cerámica/ })).toBeInTheDocument();
  });

  it("muestra estado vacío si no hay clientes que coincidan", async () => {
    installPartnerSearch(() => []);
    const user = userEvent.setup();
    renderWithProviders(
      <CustomerSelectField label="Cliente" value={null} onChange={vi.fn()} />,
    );

    await user.click(screen.getByRole("combobox", { name: "Cliente" }));
    expect(await screen.findByText("No hay clientes disponibles.")).toBeInTheDocument();
  });

  it("permite limpiar la selección", async () => {
    installPartnerSearch(() => [CLIENT]);
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <CustomerSelectField
        label="Cliente"
        value={CLIENT.id}
        selectedLabel={CLIENT.name}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Cliente" }));
    await user.click(await screen.findByRole("option", { name: "Sin cliente" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null, null);
  });

  it("abre con teclado, enfoca la búsqueda y selecciona con flechas y Enter", async () => {
    installPartnerSearch((role) => (role === "BOTH" ? [BOTH] : [CLIENT]));
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <CustomerSelectField label="Cliente" value={null} onChange={onChange} />,
    );

    const trigger = screen.getByRole("combobox", { name: "Cliente" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const search = await screen.findByLabelText("Buscar cliente");
    await waitFor(() => expect(search).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls");
    expect(screen.getByRole("listbox", { name: "Opciones de cliente" })).toBeInTheDocument();

    await screen.findByRole("option", { name: /Ana Cerámica/ });
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    expect(onChange).toHaveBeenCalledWith(CLIENT.id, CLIENT);
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
