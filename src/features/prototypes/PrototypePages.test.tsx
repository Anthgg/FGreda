import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { ApiError, resetClientState } from "@/api/client";
import { describePrototypeError } from "@/features/prototypes/prototypeLabels";
import { describeError } from "@/features/settings/messages";
import { csrfResponse, errorResponse, jsonResponse, mockFetch, renderApp, sessionResponse, TEST_USER } from "@/test/utils";
import type { Prototype } from "@/types/prototypes";

function sample(overrides: Partial<Prototype> = {}): Prototype {
  return {
    id: 7, code: "PRT-2026-000007", name: "Taza piloto", status: "CREATED", approval: "PENDING",
    technical_specifications: null, origin_quotation_ids: [],
    quotation_id: null, quotation_code: null, product_id: null, stock_location_id: null,
    quantity: 2, target_days: 4, requested_at: "2026-09-03T10:00:00Z", started_at: null,
    completed_at: null, cancelled_at: null, decided_at: null, supersedes_prototype_id: null,
    material_count: 0, notes: "Prueba controlada", quotation_payment_status: null, materials: [],
    readiness: { ready: false, issues: [{ code: "NO_QUOTATION", product_id: null, product_name: null, required_quantity: null, available_quantity: null, uom: null }] },
    ...overrides,
  };
}

const productPage = { items: [{ id: 11, internal_reference: "MAT-011", name: "Arcilla blanca", product_type: "RAW_MATERIAL", product_category_id: 1, product_category_path: null, pos_category_id: null, pos_category_name: null, base_uom_code: "g", purchase_uom_code: "kg", cost: "1", sale_price: null, sale_tax_rate: null, purchase_tax_rate: null, sellable: false, purchasable: true, available_in_pos: false, active: true, notes: null }], total: 1, limit: 200, offset: 0 };
const quotationPage = { items: [{ id: 21, code: "CTZ-2026-000021", name: "Pedido controlado", status: "CONFIRMED", product_id: 11, product_internal_reference: "MAT-011", product_name: "Arcilla blanca", quantity: 2, calculated_unit_price: "1", calculated_total: "2", total_with_tax: "2.36", total: "2.36", payment_status: "PAID", created_at: "2026-09-03", currency_code_snapshot: "PEN", currency_symbol_snapshot: "S/", exchange_rate_snapshot: null }], total: 1, limit: 200, offset: 0 };

function installBackend(initial = sample(), role: "ADMIN" | "OPERATOR" = "ADMIN") {
  let row = initial;
  const requests: Array<{ path: string; method: string; body?: string }> = [];
  const fetch = mockFetch((url, init) => {
    const path = new URL(url).pathname;
    const method = init.method ?? "GET";
    requests.push({ path, method, ...(typeof init.body === "string" ? { body: init.body } : {}) });
    if (path.endsWith("/auth/me")) return sessionResponse({ ...TEST_USER, role });
    if (path.endsWith("/auth/csrf")) return csrfResponse();
    if (path.endsWith("/products")) return jsonResponse(200, productPage);
    if (path.endsWith("/inventory/locations")) return jsonResponse(200, [{ id: 3, name: "Almacén principal", active: true }]);
    if (path.endsWith("/quotations")) return jsonResponse(200, quotationPage);
    if (path.endsWith("/prototypes") && method === "GET") return jsonResponse(200, { items: [row], total: 1, limit: 25, offset: 0 });
    if (path.endsWith("/prototypes") && method === "POST") { row = sample({ name: "Muestra standalone" }); return jsonResponse(201, row); }
    if (path.endsWith("/prototypes/7/materials") && method === "PUT") { row = sample({ materials: [{ id: 1, product_id: 11, sort_order: 0, product_name: "Arcilla blanca", product_internal_reference: "MAT-011", quantity: "5", uom_code: "g", quantity_planned: "5", quantity_actual: null, material_role: null, stage: null }], material_count: 1 }); return jsonResponse(200, row); }
    if (path.endsWith("/prototypes/7/start") && method === "POST") { row = sample({ status: "STARTED", started_at: "2026-09-03T11:00:00Z", readiness: { ready: false, issues: [{ code: "INVALID_STATE", product_id: null, product_name: null, required_quantity: null, available_quantity: null, uom: null }] } }); return jsonResponse(200, row); }
    if (path.endsWith("/prototypes/7/complete") && method === "POST") { row = sample({ status: "COMPLETED", completed_at: "2026-09-03T12:00:00Z" }); return jsonResponse(200, row); }
    if (path.endsWith("/prototypes/7/approve") && method === "POST") { row = sample({ status: "COMPLETED", approval: "APPROVED" }); return jsonResponse(200, row); }
    if (path.endsWith("/prototypes/7/reject") && method === "POST") { row = sample({ status: "COMPLETED", approval: "REJECTED" }); return jsonResponse(200, row); }
    if (path.endsWith("/prototypes/7/cancel") && method === "POST") { row = sample({ status: "CANCELLED" }); return jsonResponse(200, row); }
    if (path.endsWith("/prototypes/7/final-quotation") && method === "POST") return jsonResponse(201, { id: 55, code: "CTZ-2026-000055", status: "DRAFT", commercial_lines: [] });
    if (path.endsWith("/prototypes/7/successor") && method === "POST") return jsonResponse(201, sample({ id: 8, code: "PRT-2026-000008", name: "Taza piloto · iteración" , supersedes_prototype_id: 7 }));
    if (path.endsWith("/prototypes/8")) return jsonResponse(200, sample({ id: 8, code: "PRT-2026-000008", supersedes_prototype_id: 7 }));
    if (path.endsWith("/prototypes/7") && method === "PUT") { row = sample({ name: "Taza corregida" }); return jsonResponse(200, row); }
    if (path.endsWith("/prototypes/7")) return jsonResponse(200, row);
    return jsonResponse(200, {});
  });
  return { fetch, requests };
}

beforeEach(() => resetClientState());

describe("Fase 009K · prototipos", () => {
  it("1. muestra el listado con estados humanos", async () => { installBackend(); renderApp(["/prototipos"]); expect(await screen.findByText("PRT-2026-000007")).toBeInTheDocument(); expect(screen.getByText("Creado")).toBeInTheDocument(); expect(screen.queryByText("CREATED")).not.toBeInTheDocument(); });

  it("2. crea un prototipo standalone sin producto ni cotización", async () => { const { requests } = installBackend(); renderApp(["/prototipos/nuevo"]); await userEvent.type(await screen.findByLabelText(/^nombre/i), "Muestra standalone"); await userEvent.click(screen.getByRole("button", { name: "Crear prototipo" })); await waitFor(() => expect(requests.some((r) => r.path.endsWith("/prototypes") && r.method === "POST" && !r.body?.includes("quotation_id"))).toBe(true)); });

  it("2b. crea desde la ficha del Excel con especificaciones y materiales iniciales", async () => {
    const { requests } = installBackend();
    renderApp(["/prototipos/nuevo"]);
    await userEvent.type(await screen.findByLabelText(/^nombre/i), "Jarra prototipo");
    await userEvent.type(screen.getByLabelText(/responsable/i), "Taller");
    await userEvent.click(screen.getByRole("combobox", { name: /prioridad/i }));
    await userEvent.click(await screen.findByRole("option", { name: "Alta" }));
    fireEvent.change(screen.getByLabelText(/ancho cm/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/alto cm/i), { target: { value: "15" } });
    await userEvent.type(screen.getAllByLabelText(/técnica/i)[0]!, "Modelado");
    await userEvent.type(screen.getByLabelText(/esmalte \/ acabado/i), "Barniz base 57");
    await userEvent.click(screen.getByRole("button", { name: /añadir material/i }));
    await userEvent.click(screen.getByRole("combobox", { name: /^material/i }));
    await userEvent.click(await screen.findByRole("option", { name: /MAT-011 · Arcilla blanca/i }));
    fireEvent.change(screen.getByLabelText(/cantidad prevista \(g\)/i), { target: { value: "30" } });
    await userEvent.click(screen.getByRole("button", { name: "Crear prototipo" }));
    await waitFor(() => {
      const body = requests.find((r) => r.path.endsWith("/prototypes") && r.method === "POST")?.body;
      expect(body).toContain('"materials":[{"product_id":11,"quantity":"30"}]');
      expect(body).toContain("[Especificaciones]");
      expect(body).toContain("Ancho cm: 10");
      expect(body).toContain("Esmalte/Acabado: Barniz base 57");
      expect(body).toContain("Prioridad: Alta");
    });
  });

  it("3. enseña el código emitido por backend después de crear", async () => { installBackend(); renderApp(["/prototipos/nuevo"]); await userEvent.type(await screen.findByLabelText(/^nombre/i), "Muestra standalone"); await userEvent.click(screen.getByRole("button", { name: "Crear prototipo" })); expect(await screen.findByText(/creado con código PRT-2026-000007/i)).toBeInTheDocument(); });

  it("4. permite editar mientras está CREATED", async () => { const { requests } = installBackend(); renderApp(["/prototipos/7/editar"]); const field = await screen.findByLabelText(/^nombre/i); fireEvent.change(field, { target: { value: "Taza corregida" } }); await userEvent.click(screen.getByRole("button", { name: /guardar cambios/i })); await waitFor(() => expect(requests.some((r) => r.path.endsWith("/prototypes/7") && r.method === "PUT" && r.body?.includes("Taza corregida"))).toBe(true)); });

  it("5. añade material desde el catálogo real y conserva su unidad", async () => { const { requests } = installBackend(); renderApp(["/prototipos/7/materiales"]); await userEvent.click(await screen.findByRole("button", { name: /añadir material/i })); await userEvent.click(screen.getByRole("combobox", { name: /^material/i })); await userEvent.click(await screen.findByRole("option", { name: /MAT-011 · Arcilla blanca/i })); fireEvent.change(screen.getByLabelText(/cantidad \(g\)/i), { target: { value: "5" } }); await userEvent.click(screen.getByRole("button", { name: /guardar materiales/i })); await waitFor(() => expect(requests.some((r) => r.path.endsWith("/materials") && r.body?.includes('"quantity":"5"'))).toBe(true)); });

  it("6. sin cotización explica el bloqueo y no ofrece START", async () => { installBackend(); renderApp(["/prototipos/7/operacion"]); expect(await screen.findByText(/vincula una cotización pagada/i)).toBeInTheDocument(); expect(screen.queryByRole("button", { name: /iniciar fabricación/i })).not.toBeInTheDocument(); });

  it("7. UNPAID explica el bloqueo", async () => { installBackend(sample({ quotation_id: 21, quotation_code: "CTZ-2026-000021", quotation_payment_status: "UNPAID", readiness: { ready: false, issues: [{ code: "QUOTATION_UNPAID", product_id: null, product_name: null, required_quantity: null, available_quantity: null, uom: null }] } })); renderApp(["/prototipos/7/operacion"]); expect(await screen.findByText(/pendiente de pago/i)).toBeInTheDocument(); expect(screen.queryByRole("button", { name: /iniciar fabricación/i })).not.toBeInTheDocument(); });

  it("8. PAID y ready permite START", async () => { const { requests } = installBackend(sample({ quotation_id: 21, quotation_code: "CTZ-2026-000021", quotation_payment_status: "PAID", stock_location_id: 3, readiness: { ready: true, issues: [] } })); renderApp(["/prototipos/7/operacion"]); await userEvent.click(await screen.findByRole("button", { name: /iniciar fabricación/i })); await waitFor(() => expect(requests.some((r) => r.path.endsWith("/start") && r.method === "POST")).toBe(true)); });

  it("9. STARTED bloquea materiales", async () => { installBackend(sample({ status: "STARTED" })); renderApp(["/prototipos/7/materiales"]); expect(await screen.findByText(/materiales están bloqueados/i)).toBeInTheDocument(); expect(screen.queryByRole("button", { name: /añadir material/i })).not.toBeInTheDocument(); });

  it("10. completa únicamente un prototipo STARTED", async () => { const { requests } = installBackend(sample({ status: "STARTED" })); renderApp(["/prototipos/7/operacion"]); await userEvent.click(await screen.findByRole("button", { name: /completar prototipo/i })); await waitFor(() => expect(requests.some((r) => r.path.endsWith("/complete") && r.method === "POST")).toBe(true)); });

  it("11. OPERATOR no ve approve, reject ni cancel", async () => { installBackend(sample({ status: "COMPLETED" }), "OPERATOR"); renderApp(["/prototipos/7/evaluacion"]); await screen.findAllByText("Evaluación"); expect(screen.queryByRole("button", { name: /^aprobar$/i })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: /^rechazar$/i })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: /anular prototipo/i })).not.toBeInTheDocument(); });

  it("12. ADMIN aprueba", async () => { const { requests } = installBackend(sample({ status: "COMPLETED" })); renderApp(["/prototipos/7/evaluacion"]); await userEvent.click(await screen.findByRole("button", { name: /^aprobar$/i })); await waitFor(() => expect(requests.some((r) => r.path.endsWith("/approve") && r.method === "POST")).toBe(true)); });

  it("13. ADMIN rechaza", async () => { const { requests } = installBackend(sample({ status: "COMPLETED" })); renderApp(["/prototipos/7/evaluacion"]); await userEvent.click(await screen.findByRole("button", { name: /^rechazar$/i })); await waitFor(() => expect(requests.some((r) => r.path.endsWith("/reject") && r.method === "POST")).toBe(true)); });

  it("14. crea successor con un nuevo PRT", async () => { installBackend(sample({ status: "COMPLETED", approval: "REJECTED" })); renderApp(["/prototipos/7/iteraciones"]); await userEvent.click(await screen.findByRole("button", { name: /crear nueva iteración/i })); expect((await screen.findAllByText("PRT-2026-000008")).length).toBeGreaterThan(0); });

  it("15. ADMIN puede anular CREATED", async () => { const { requests } = installBackend(); renderApp(["/prototipos/7"]); await userEvent.click(await screen.findByRole("button", { name: /anular prototipo/i })); await waitFor(() => expect(requests.some((r) => r.path.endsWith("/cancel") && r.method === "POST")).toBe(true)); });

  it("16. traduce códigos de dominio", () => { expect(describePrototypeError(new ApiError("PROTOTYPE_NOT_CANCELLABLE", "raw", 409))).toMatch(/material ya fue consumido/i); });

  it("17. nunca presenta PostgreSQL o IntegrityError crudos", async () => { mockFetch((url) => new URL(url).pathname.endsWith("/auth/me") ? sessionResponse() : errorResponse(500, "INTERNAL_ERROR", "IntegrityError: duplicate key PostgreSQL")); renderApp(["/prototipos/7"]); const alert = await screen.findByRole("alert"); expect(alert).not.toHaveTextContent(/IntegrityError|PostgreSQL|duplicate key/i); });

  it("18. traduce el guard de prototipo de ProductionOrder", () => { expect(describeError(new ApiError("PRODUCTION_ORDER_PROTOTYPE_NOT_APPROVED", "raw", 409))).toBe("La producción no puede iniciar hasta que el prototipo requerido sea aprobado."); });

  // -------------------------------------------------------------------
  // Fase 009K.1 — el puente a la cotizacion final
  // -------------------------------------------------------------------
  it("K1-1. una muestra sin aprobar no ofrece cotizar", async () => {
    installBackend(sample({ status: "COMPLETED", approval: "PENDING" }));
    renderApp(["/prototipos/7/evaluacion"]);
    await screen.findByRole("heading", { name: "Evaluación" });
    expect(screen.queryByRole("button", { name: /crear cotización final/i })).not.toBeInTheDocument();
  });

  it("K1-2. una muestra aprobada ofrece crear la cotización final", async () => {
    installBackend(sample({ status: "COMPLETED", approval: "APPROVED" }));
    renderApp(["/prototipos/7/evaluacion"]);
    expect(await screen.findByRole("button", { name: /crear cotización final/i })).toBeInTheDocument();
  });

  it("K1-3. pulsar lleva al borrador que devuelve el backend", async () => {
    // La idempotencia se siente natural porque 201 y 200 hacen lo mismo:
    // abrir la cotizacion devuelta. No hay ningun «ya existe» que mostrar.
    const { requests } = installBackend(sample({ status: "COMPLETED", approval: "APPROVED" }));
    renderApp(["/prototipos/7/evaluacion"]);
    await userEvent.click(await screen.findByRole("button", { name: /crear cotización final/i }));
    await waitFor(() =>
      expect(
        requests.some((r) => r.path.endsWith("/prototypes/7/final-quotation") && r.method === "POST"),
      ).toBe(true),
    );
  });

  it("K1-4. el taller no cotiza", async () => {
    // FRONTEND_PROTOTYPE_SECURITY_AUTHORITY sigue en 0: esto es UX. La
    // autoridad es el backend, que responde 403 igualmente.
    installBackend(sample({ status: "COMPLETED", approval: "APPROVED" }), "OPERATOR");
    renderApp(["/prototipos/7/evaluacion"]);
    await screen.findByRole("heading", { name: "Evaluación" });
    expect(screen.queryByRole("button", { name: /crear cotización final/i })).not.toBeInTheDocument();
  });
});
