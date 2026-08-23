import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DatePickerField } from "@/components/DatePickerField";
import {
  formatDisplayDate,
  formatISODate,
  getTodayLocal,
  parseISODate,
} from "@/components/dateFormat";
import { borradorVacio, firingADraft } from "@/features/firings/draft";


describe("DatePickerField - Selector de Fecha Controlado por React", () => {
  it("DATE_TIMEZONE_SAFE: parseo y formateo son inmunes a desfases por zona horaria", () => {
    const parsed = parseISODate("2026-08-23");
    expect(parsed).toEqual({ year: 2026, month: 8, day: 23 });

    const display = formatDisplayDate("2026-08-23");
    expect(display).toBe("23/08/2026");

    const iso = formatISODate(2026, 8, 23);
    expect(iso).toBe("2026-08-23");

    // Formato inválido o vacío devuelve null / ""
    expect(parseISODate("")).toBeNull();
    expect(parseISODate("texto-invalido")).toBeNull();
    expect(parseISODate("2026-99-99")).toBeNull();
    expect(formatDisplayDate("")).toBe("");
  });

  it("DISPLAY_FORMAT & API_FORMAT: muestra DD/MM/YYYY y preserva YYYY-MM-DD en valor", () => {
    render(
      <DatePickerField
        label="Fecha de quema"
        value="2026-08-23"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Fecha de quema")).toBeInTheDocument();
    // Botón trigger muestra la fecha en formato legible DD/MM/YYYY
    expect(screen.getByText("23/08/2026")).toBeInTheDocument();
  });

  it("NATIVE_DATE_INPUT_COUNT: no renderiza ningún elemento <input type=\"date\">", () => {
    const { container } = render(
      <DatePickerField
        label="Fecha de quema"
        value="2026-08-23"
        onChange={vi.fn()}
      />,
    );

    const nativeDateInputs = container.querySelectorAll("input[type='date']");
    expect(nativeDateInputs.length).toBe(0);

    const nativeSelects = container.querySelectorAll("select");
    expect(nativeSelects.length).toBe(0);
  });

  it("CLICK_FIELD_OPENS_CALENDAR & SELECT_DATE: abrir calendario y seleccionar un día", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <DatePickerField
        label="Fecha de quema"
        value="2026-08-23"
        onChange={handleChange}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Fecha de quema" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Al hacer click se abre el popover del calendario
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const dialog = screen.getByRole("dialog", { name: "Calendario de selección de fecha" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Agosto 2026")).toBeInTheDocument();

    // Seleccionar día 15
    const dia15 = screen.getByRole("button", { name: "15 de Agosto de 2026" });
    await user.click(dia15);

    expect(handleChange).toHaveBeenCalledWith("2026-08-15");
    // Popover se cierra tras seleccionar
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("TODAY_ACTION: el botón Hoy selecciona la fecha local actual", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const today = getTodayLocal();

    render(
      <DatePickerField
        label="Fecha de quema"
        value=""
        placeholder="DD/MM/AAAA"
        onChange={handleChange}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Fecha de quema" });
    await user.click(trigger);

    const hoyBtn = screen.getByRole("button", { name: "Hoy" });
    await user.click(hoyBtn);

    expect(handleChange).toHaveBeenCalledWith(today.iso);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("CLEAR_ACTION: el botón Limpiar borra la fecha enviando cadena vacía", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <DatePickerField
        label="Fecha de quema"
        value="2026-08-23"
        onChange={handleChange}
        clearable
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Fecha de quema" });
    await user.click(trigger);

    const limpiarBtn = screen.getByRole("button", { name: "Limpiar" });
    await user.click(limpiarBtn);

    expect(handleChange).toHaveBeenCalledWith("");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("NAVEGACIÓN DE MES: botones anterior y siguiente cambian el mes mostrado", async () => {
    const user = userEvent.setup();

    render(
      <DatePickerField
        label="Fecha de quema"
        value="2026-08-23"
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Fecha de quema" });
    await user.click(trigger);

    expect(screen.getByText("Agosto 2026")).toBeInTheDocument();

    const prevBtn = screen.getByRole("button", { name: "Mes anterior" });
    await user.click(prevBtn);
    expect(screen.getByText("Julio 2026")).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: "Mes siguiente" });
    await user.click(nextBtn);
    await user.click(nextBtn);
    expect(screen.getByText("Septiembre 2026")).toBeInTheDocument();
  });

  it("ESCAPE_CLOSE & OUTSIDE_CLICK_CLOSE: cerrar con tecla Escape y click fuera", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <DatePickerField
          label="Fecha de quema"
          value="2026-08-23"
          onChange={vi.fn()}
        />
        <button type="button">Elemento Externo</button>
      </div>,
    );

    const trigger = screen.getByRole("combobox", { name: "Fecha de quema" });

    // Abrir y cerrar con Escape
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Abrir y cerrar con click fuera
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText("Elemento Externo"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("DEFAULT_DATE_NEW_FIRING: borradorVacio inicializa la fecha en HOY", () => {
    const draft = borradorVacio();
    const today = getTodayLocal();
    expect(draft.firing_date).toBe(today.iso);
  });

  it("EDIT_EXISTING_DATE: firingADraft preserva la fecha existente", () => {
    const mockFiring = {

      id: 1,
      code: "QUE-0001",
      status: "DRAFT" as const,
      scheduled_date: null,
      firing_date: "2026-08-20",

      notes: null,
      total_pieces: 1,
      total_volume_cm3: "1000",
      occupancy_percentage: "10",
      occupancy_factor: "1.0",
      subtotal: "50",
      total_cost: "50",
      created_at: "2026-08-20T10:00:00Z",
      updated_at: "2026-08-20T10:00:00Z",
      confirmed_at: null,
      cancelled_at: null,
      created_by_id: "usr-1",
      sessions: [],
      lines: [],
    };

    const draft = firingADraft(mockFiring);

    expect(draft.firing_date).toBe("2026-08-20");
    expect(formatDisplayDate(draft.firing_date)).toBe("20/08/2026");
  });
});

