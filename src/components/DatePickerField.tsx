/**
 * Selector de fecha accesible y controlado exclusivamente por React.
 *
 * Trabaja con cadenas canónicas en formato ISO "YYYY-MM-DD" para el backend
 * y las formatea como "DD/MM/YYYY" para la interfaz, evitando cualquier salto
 * o desfase por zonas horarias o conversiones UTC.
 *
 * Sin controles nativos de fecha ni elementos select del navegador.
 */

import { useEffect, useId, useRef, useState } from "react";
import {
  formatDisplayDate,
  formatISODate,
  getTodayLocal,
  parseISODate,
} from "@/components/dateFormat";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

export interface DatePickerFieldProps {
  label: string;
  value: string | null | undefined;
  onChange: (date: string) => void;
  requirement?: "required" | "optional" | "automatic" | undefined;
  placeholder?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  disabled?: boolean | undefined;
  clearable?: boolean | undefined;
  className?: string | undefined;
  id?: string | undefined;
}

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"] as const;

interface CalendarDay {
  year: number;
  month: number;
  day: number;
  iso: string;
  isCurrentMonth: boolean;
}

function buildCalendarGrid(year: number, month: number): CalendarDay[] {
  const firstDayOfMonth = new Date(year, month - 1, 1);
  // getDay(): 0 para Domingo, 1 para Lunes...
  // Convertimos a índice base Lunes (0 = Lu ... 6 = Do)
  const startingDayIndex = (firstDayOfMonth.getDay() + 6) % 7;

  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const grid: CalendarDay[] = [];

  // Días del mes anterior
  const prevMonthNum = month === 1 ? 12 : month - 1;
  const prevYearNum = month === 1 ? year - 1 : year;
  for (let i = startingDayIndex - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    grid.push({
      year: prevYearNum,
      month: prevMonthNum,
      day,
      iso: formatISODate(prevYearNum, prevMonthNum, day),
      isCurrentMonth: false,
    });
  }

  // Días del mes actual
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push({
      year,
      month,
      day: d,
      iso: formatISODate(year, month, d),
      isCurrentMonth: true,
    });
  }

  // Días del mes siguiente para completar la matriz (35 o 42 celdas)
  const remaining = (7 - (grid.length % 7)) % 7;
  const nextMonthNum = month === 12 ? 1 : month + 1;
  const nextYearNum = month === 12 ? year + 1 : year;
  for (let d = 1; d <= remaining; d++) {
    grid.push({
      year: nextYearNum,
      month: nextMonthNum,
      day: d,
      iso: formatISODate(nextYearNum, nextMonthNum, d),
      isCurrentMonth: false,
    });
  }

  return grid;
}

export function DatePickerField({
  label,
  value,
  onChange,
  requirement,
  placeholder = "DD/MM/AAAA",
  hint,
  error,
  disabled = false,
  clearable = true,
  className = "",
  id: explicitId,
}: DatePickerFieldProps) {
  const generatedId = useId();
  const inputId = explicitId ?? generatedId;
  const popoverId = `${inputId}-calendar-popover`;

  const [isOpen, setIsOpen] = useState(false);

  const parsedValue = parseISODate(value);
  const today = getTodayLocal();

  // Estado de navegación del mes visible
  const [viewYear, setViewYear] = useState<number>(parsedValue?.year ?? today.year);
  const [viewMonth, setViewMonth] = useState<number>(parsedValue?.month ?? today.month);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sincronizar vista si el valor cambia externamente
  useEffect(() => {
    const parsed = parseISODate(value);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [value]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const mesAnterior = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const mesSiguiente = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const seleccionarDia = (iso: string) => {
    onChange(iso);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const seleccionarHoy = () => {
    onChange(today.iso);
    setViewYear(today.year);
    setViewMonth(today.month);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const limpiarFecha = () => {
    onChange("");
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && isOpen) {
      e.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  const displayValue = formatDisplayDate(value);
  const grid = buildCalendarGrid(viewYear, viewMonth);

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      <label
        htmlFor={inputId}
        className="flex items-baseline justify-between gap-2 text-xs font-medium text-zinc-700 mb-1"
      >
        <span>{label}</span>
        {requirement ? (
          <span
            className={
              requirement === "required"
                ? "text-orange-600 font-semibold"
                : "font-normal text-zinc-400"
            }
          >
            {requirement === "required"
              ? "* Obligatorio"
              : requirement === "optional"
                ? "Opcional"
                : "Automático"}
          </span>
        ) : null}
      </label>

      {/* Trigger visual accesible que simula el control de entrada */}
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-haspopup="dialog"
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            if (!isOpen && parsedValue) {
              setViewYear(parsedValue.year);
              setViewMonth(parsedValue.month);
            }
            setIsOpen((prev) => !prev);
          }
        }}
        className={[
          "w-full h-10 rounded-xl border bg-white/55 backdrop-blur-xs px-3 py-2 text-xs sm:text-sm shadow-2xs flex items-center justify-between text-left transition-all cursor-pointer",
          error ? "border-red-500 ring-1 ring-red-500" : "border-black/[0.08]",
          isOpen ? "border-black ring-1 ring-black bg-white/80" : "hover:border-black/20",
          disabled ? "cursor-not-allowed bg-white/30 text-zinc-400 opacity-50" : "text-zinc-900",
        ].join(" ")}
      >
        <span className={displayValue ? "text-zinc-900 font-medium" : "text-zinc-400"}>
          {displayValue || placeholder}
        </span>
        <CalendarIcon className="size-4 text-zinc-400 shrink-0 ml-2" aria-hidden="true" />
      </button>

      {error ? (
        <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-zinc-400">{hint}</p>
      ) : null}

      {/* Popover del Calendario */}
      {isOpen && !disabled ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Calendario de selección de fecha"
          className="absolute left-0 z-50 mt-1.5 w-72 rounded-2xl border border-white/60 bg-white/95 backdrop-blur-xl p-3.5 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {/* Cabecera del Mes y Botones de Navegación */}
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-black/[0.04]">
            <button
              type="button"
              onClick={mesAnterior}
              aria-label="Mes anterior"
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.04] transition-colors cursor-pointer"
            >
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
            </button>

            <span className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
              {MESES[viewMonth - 1]} {viewYear}
            </span>

            <button
              type="button"
              onClick={mesSiguiente}
              aria-label="Mes siguiente"
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.04] transition-colors cursor-pointer"
            >
              <ChevronRightIcon className="size-4" aria-hidden="true" />
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DIAS_SEMANA.map((dia) => (
              <span key={dia} className="text-[10px] font-semibold text-zinc-400 py-1 uppercase">
                {dia}
              </span>
            ))}
          </div>

          {/* Rejilla de Días */}
          <div className="grid grid-cols-7 gap-1">
            {grid.map((item) => {
              const isSelected = item.iso === value;
              const isToday = item.iso === today.iso;

              return (
                <button
                  key={item.iso}
                  type="button"
                  onClick={() => seleccionarDia(item.iso)}
                  aria-label={`${item.day} de ${MESES[item.month - 1]} de ${item.year}`}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  className={[
                    "h-8 w-8 text-xs rounded-xl flex items-center justify-center transition-all cursor-pointer select-none",
                    isSelected
                      ? "bg-black text-white font-bold shadow-2xs"
                      : isToday
                        ? "border border-black/30 font-bold text-zinc-950 hover:bg-black/[0.04]"
                        : item.isCurrentMonth
                          ? "text-zinc-800 hover:bg-black/[0.04] font-medium"
                          : "text-zinc-300 hover:bg-black/[0.02]",
                  ].join(" ")}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {/* Acciones Rápidas (Hoy / Limpiar) */}
          <div className="flex items-center justify-between border-t border-black/[0.04] pt-2.5 mt-2.5">
            <button
              type="button"
              onClick={seleccionarHoy}
              className="text-xs font-semibold text-zinc-900 hover:text-zinc-600 px-2 py-1 rounded-lg hover:bg-black/[0.04] transition-colors cursor-pointer"
            >
              Hoy
            </button>

            {clearable ? (
              <button
                type="button"
                onClick={limpiarFecha}
                className="text-xs font-semibold text-zinc-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50/50 transition-colors cursor-pointer"
              >
                Limpiar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
