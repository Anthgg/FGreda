import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { anunciarDescarte } from "@/components/borradores";
import { DecimalField } from "@/components/DecimalField";

/**
 * El campo numérico compartido del Cotizador V2 (Fase 010G).
 *
 * Lo que aquí se fija es el comportamiento que las tres copias anteriores
 * tenían cada una a su manera: cuándo guarda, qué manda cuando está vacío y
 * qué NO manda cuando el texto no es un número.
 */
describe("DecimalField", () => {
  it("guarda al salir del campo, no mientras se escribe", async () => {
    const onCommit = vi.fn();
    render(<DecimalField label="Peso" value="500.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Peso/));
    await user.type(screen.getByLabelText(/^Peso/), "300");
    // Todavía dentro del campo: nada ha salido.
    expect(onCommit).not.toHaveBeenCalled();

    await user.tab();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("300");
  });

  it("acepta la coma peruana y manda el punto", async () => {
    const onCommit = vi.fn();
    render(<DecimalField label="Tarifa" value="" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Tarifa/), "2,5");
    await user.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("2.5");
  });

  it("un campo vacío manda null, no cero", async () => {
    const onCommit = vi.fn();
    render(<DecimalField label="Peso" value="500.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Peso/));
    await user.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("un texto que no es número no manda nada y se explica", async () => {
    const onCommit = vi.fn();
    render(<DecimalField label="Peso" value="500.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Peso/));
    await user.type(screen.getByLabelText(/^Peso/), "abc");
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/coma o punto/i)).toBeInTheDocument();
  });

  it("no gasta una petición si el valor acaba donde empezó", async () => {
    const onCommit = vi.fn();
    render(<DecimalField label="Peso" value="500.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText(/^Peso/));
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("escribir la misma cifra de otra forma tampoco gasta una petición", async () => {
    // «500» guardado y «500,0» escrito son el mismo número. Comparando texto
    // no lo eran, y cada visita al campo mandaba un guardado que no cambiaba
    // nada: una petición, un recálculo de la cotización entera y una entrada
    // de auditoría por reescribir el mismo valor.
    const onCommit = vi.fn();
    render(<DecimalField label="Peso" value="500.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    for (const forma of ["500,0", "0500", "500."]) {
      await user.clear(screen.getByLabelText(/^Peso/));
      await user.type(screen.getByLabelText(/^Peso/), forma);
      await user.tab();
    }

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("tras salir del campo sigue ensenando lo enviado, no el valor anterior", async () => {
    // Revision de Codex: al salir, el campo volvia a pintar lo guardado ANTES
    // mientras el guardado nuevo seguia en vuelo. Quien volvia a entrar
    // enseguida editaba el valor viejo y lo acababa guardando.
    const onCommit = vi.fn();
    render(<DecimalField label="Peso" value="500.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Peso/));
    await user.type(screen.getByLabelText(/^Peso/), "300");
    await user.tab();

    // El padre todavia no ha recibido el valor nuevo: sigue diciendo 500.
    expect(onCommit).toHaveBeenCalledWith("300");
    expect(screen.getByLabelText(/^Peso/)).toHaveValue("300");
  });

  it("si se desmonta con cambios sin salir del campo, los confirma", async () => {
    // Revision de Codex: volver atras con el navegador o cambiar de ruta no
    // pasa por un blur, y lo tecleado desaparecia con el componente.
    const onCommit = vi.fn();
    const { unmount } = render(
      <DecimalField label="Peso" value="500.000000" onCommit={onCommit} />,
    );
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Peso/));
    await user.type(screen.getByLabelText(/^Peso/), "250");
    expect(onCommit).not.toHaveBeenCalled();

    unmount();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("250");
  });

  it("salir del campo y desmontarse enseguida guarda UNA vez, no dos", async () => {
    // Re-revision de Codex, reproducida antes de corregirla: tras el blur lo
    // guardado no cambia hasta el refetch, el campo seguia contando como
    // «sucio» y, al desmontarse con el envio en vuelo —un clic directo en otro
    // paso—, confirmaba OTRA VEZ. onCommit llegaba dos veces con "300".
    const onCommit = vi.fn();
    const { unmount } = render(
      <DecimalField label="Peso" value="500.000000" onCommit={onCommit} />,
    );
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Peso/));
    await user.type(screen.getByLabelText(/^Peso/), "300");
    await user.tab();
    unmount();

    expect(onCommit.mock.calls).toEqual([["300"]]);
  });

  it("el refetch de un guardado ANTERIOR no pisa lo enviado despues", async () => {
    // Dos guardados del mismo campo en fila: «20» y enseguida «20,5». Si el
    // refetch del primero llega con el segundo aun en vuelo, lo guardado pasa a
    // «20»; dar por alcanzado lo enviado solo porque lo guardado cambio pintaba
    // ese valor intermedio y viejo, y quien volvia a entrar editaba lo obsoleto.
    const onCommit = vi.fn();
    const { rerender } = render(<DecimalField label="Alto" value="" onCommit={onCommit} />);
    const user = userEvent.setup();
    const campo = () => screen.getByLabelText(/^Alto/);

    await user.type(campo(), "20");
    await user.tab();
    await user.clear(campo());
    await user.type(campo(), "20,5");
    await user.tab();
    expect(onCommit.mock.calls).toEqual([["20"], ["20.5"]]);

    // Llega el refetch del PRIMER guardado.
    rerender(<DecimalField label="Alto" value="20.000000" onCommit={onCommit} />);
    expect(campo()).toHaveValue("20,5");

    // Llega el del segundo: ahora si coincide, y se ensena lo guardado.
    rerender(<DecimalField label="Alto" value="20.500000" onCommit={onCommit} />);
    expect(campo()).toHaveValue("20.5");
  });

  it("si el backend normaliza lo guardado, al terminar el guardado ensena lo guardado", async () => {
    // BLOCKER de la tercera revision de Codex. La columna es NUMERIC(...,6):
    // `20,5000004` se guarda como `20.500000`. Con la regla de coincidencia
    // exacta el campo no lo reconocia nunca y seguia ensenando lo tecleado,
    // mientras el pie decia «guardado». Ahora el campo recibe el resultado de SU
    // guardado y, al terminar bien, se alinea con lo guardado.
    let terminar: (resultado: { ok: boolean; firma: string }) => void = () => undefined;
    const onCommit = vi.fn(
      () =>
        new Promise<{ ok: boolean; firma: string }>((resolver) => {
          terminar = resolver;
        }),
    );
    const { rerender } = render(<DecimalField label="Alto" value="20.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Alto/));
    await user.type(screen.getByLabelText(/^Alto/), "20,5000004");
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith("20.5000004");

    // Llega lo guardado, normalizado por la columna, y termina el guardado.
    rerender(<DecimalField label="Alto" value="20.500000" onCommit={onCommit} />);
    await act(async () => terminar({ ok: true, firma: "linea-editar:7:height_cm" }));

    expect(screen.getByLabelText(/^Alto/)).toHaveValue("20.5");
  });

  it("guardado aceptado pero SIN dato fresco: sigue ensenando lo enviado, no lo viejo", async () => {
    // Cuarta revision de Codex: si el refetch falla, TanStack se traga el error.
    // Alinearse entonces con lo guardado pintaria el valor ANTERIOR sobre un
    // cambio que el servidor si acepto.
    let terminar: (resultado: { ok: boolean; firma: string; fresco?: boolean }) => void = () =>
      undefined;
    const onCommit = vi.fn(
      () =>
        new Promise<{ ok: boolean; firma: string; fresco?: boolean }>((resolver) => {
          terminar = resolver;
        }),
    );
    render(<DecimalField label="Alto" value="20.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Alto/));
    await user.type(screen.getByLabelText(/^Alto/), "25");
    await user.tab();
    await act(async () => terminar({ ok: true, firma: "linea-editar:7:height_cm", fresco: false }));

    // El dato de la pantalla sigue diciendo 20: el campo no se alinea con eso.
    expect(screen.getByLabelText(/^Alto/)).toHaveValue("25");
  });

  it("si el guardado falla, conserva lo tecleado; un descarte de OTRO dato no lo toca", async () => {
    let terminar: (resultado: { ok: boolean; firma: string }) => void = () => undefined;
    const onCommit = vi.fn(
      () =>
        new Promise<{ ok: boolean; firma: string }>((resolver) => {
          terminar = resolver;
        }),
    );
    render(<DecimalField label="Alto" value="20.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Alto/));
    await user.type(screen.getByLabelText(/^Alto/), "33");
    await user.tab();
    await act(async () => terminar({ ok: false, firma: "linea-editar:7:height_cm" }));
    expect(screen.getByLabelText(/^Alto/)).toHaveValue("33");

    // Se descarta un fallo de OTRO campo: este no se mueve.
    act(() => anunciarDescarte("linea-editar:7:width_cm"));
    expect(screen.getByLabelText(/^Alto/)).toHaveValue("33");

    // Se descarta el SUYO: vuelve a lo guardado.
    act(() => anunciarDescarte("linea-editar:7:height_cm"));
    expect(screen.getByLabelText(/^Alto/)).toHaveValue("20");
  });

  it("un campo con el guardado EN VUELO no escucha ningun descarte", async () => {
    // Tercera revision de Codex: la senal global revertia tambien un campo con
    // un envio en vuelo que iba a tener exito.
    const onCommit = vi.fn(() => new Promise<{ ok: boolean; firma: string }>(() => undefined));
    render(<DecimalField label="Alto" value="20.000000" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Alto/));
    await user.type(screen.getByLabelText(/^Alto/), "44");
    await user.tab();

    act(() => anunciarDescarte("linea-editar:7:height_cm"));
    expect(screen.getByLabelText(/^Alto/)).toHaveValue("44");
  });

  it("un campo que pasa a deshabilitado no confirma al desmontarse", async () => {
    // Re-revision de Codex: si la cotizacion deja de ser editable con un
    // borrador a medias, confirmar al desmontar escribiria contra una
    // cotizacion ya emitida y dejaria un error artificial.
    const onCommit = vi.fn();
    const { rerender, unmount } = render(
      <DecimalField label="Peso" value="500.000000" onCommit={onCommit} />,
    );
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Peso/));
    await user.type(screen.getByLabelText(/^Peso/), "250");
    rerender(<DecimalField label="Peso" value="500.000000" onCommit={onCommit} disabled />);
    unmount();

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("enseña el valor guardado sin los ceros de cola", () => {
    render(<DecimalField label="Costo" value="0.001300" onCommit={vi.fn()} />);
    expect(screen.getByLabelText(/^Costo/)).toHaveValue("0.0013");
  });

  it("un entero rechaza el separador decimal", async () => {
    const onCommit = vi.fn();
    render(<DecimalField label="Piezas" value="20" onCommit={onCommit} entero />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Piezas/));
    await user.type(screen.getByLabelText(/^Piezas/), "10,5");
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/entero/i)).toBeInTheDocument();
  });

  it("un obligatorio vacío se explica en vez de mandarse", async () => {
    // Ni `null` —que lo retiraría— ni 0 —que lo inventaría—.
    const onCommit = vi.fn();
    render(
      <DecimalField label="Piezas" requirement="required" value="20" onCommit={onCommit} entero />,
    );
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Piezas/));
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/vacío no es cero/i)).toBeInTheDocument();
  });

  it("rechaza un negativo salvo que se permita", async () => {
    const onCommit = vi.fn();
    render(<DecimalField label="Tarifa" value="" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Tarifa/), "-5");
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/negativo/i)).toBeInTheDocument();
  });

  it("el error se retira en cuanto se corrige", async () => {
    render(<DecimalField label="Peso" value="" onCommit={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Peso/), "abc");
    await user.tab();
    expect(screen.getByText(/coma o punto/i)).toBeInTheDocument();

    // `user.type` CONCATENA: sin limpiar antes, el campo quedaria en «abc1» y
    // la prueba pasaria por el motivo equivocado —cualquier tecla retira el
    // error— sin comprobar nunca que lo escrito ya es valido.
    await user.clear(screen.getByLabelText(/^Peso/));
    await user.type(screen.getByLabelText(/^Peso/), "1");
    expect(screen.queryByText(/coma o punto/i)).toBeNull();

    await user.tab();
    expect(screen.queryByText(/coma o punto/i)).toBeNull();
  });
});
