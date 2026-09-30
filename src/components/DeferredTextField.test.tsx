import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { anunciarDescarte } from "@/components/borradores";
import { DeferredTextField } from "@/components/DeferredTextField";

describe("DeferredTextField", () => {
  it("edita localmente y guarda una sola vez al salir", async () => {
    const onCommit = vi.fn();
    render(<DeferredTextField label="Nombre" value="Arcilla" onCommit={onCommit} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText(/^Nombre/);

    await user.clear(input);
    await user.type(input, "Nueva arcilla");
    expect(onCommit).not.toHaveBeenCalled();

    await user.tab();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("Nueva arcilla");
  });

  it("envía un valor vacío para retirar texto persistido", async () => {
    const onCommit = vi.fn();
    render(<DeferredTextField label="Nombre" value="Arcilla" onCommit={onCommit} />);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Nombre/));
    expect(onCommit).not.toHaveBeenCalled();
    await user.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("");
  });

  it("confirma al desmontarse si hay un borrador protegido sin blur", async () => {
    const onCommit = vi.fn();
    const { unmount } = render(
      <DeferredTextField label="Nombre" value="Inicial" onCommit={onCommit} />,
    );
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText(/^Nombre/));
    await user.type(screen.getByLabelText(/^Nombre/), "Borrador");
    expect(onCommit).not.toHaveBeenCalled();
    unmount();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("Borrador");
  });

  it("no pisa el borrador con un refetch mientras el campo está abierto", async () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <DeferredTextField label="Nombre" value="Feria" onCommit={onCommit} />,
    );
    const user = userEvent.setup();
    const input = screen.getByLabelText(/^Nombre/);

    await user.clear(input);
    await user.type(input, "Feria de octubre");
    rerender(<DeferredTextField label="Nombre" value="Feria" onCommit={onCommit} />);
    expect(input).toHaveValue("Feria de octubre");
    expect(onCommit).not.toHaveBeenCalled();

    await user.tab();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("Feria de octubre");
  });

  it("sigue el valor externo cuando no hay una edición abierta", () => {
    const { rerender } = render(
      <DeferredTextField label="Nombre" value="Inicial" onCommit={vi.fn()} />,
    );

    rerender(<DeferredTextField label="Nombre" value="Actualizado" onCommit={vi.fn()} />);
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue("Actualizado");
  });

  it("puede recortar espacios al confirmar campos de línea", async () => {
    const onCommit = vi.fn();
    render(
      <DeferredTextField
        label="Nombre"
        value="Inicial"
        onCommit={onCommit}
        trimOnCommit
      />,
    );
    const user = userEvent.setup();
    const input = screen.getByLabelText(/^Nombre/);

    await user.clear(input);
    await user.type(input, "  Plato nuevo  ");
    await user.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("Plato nuevo");
  });

  it("conserva texto tras un error hasta que se descarta su guardado", async () => {
    const onCommit = vi.fn(() => Promise.reject(new Error("falló el guardado")));
    render(<DeferredTextField label="Nombre" value="Inicial" onCommit={onCommit} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText(/^Nombre/);

    await user.clear(input);
    await user.type(input, "Intento");
    await user.tab();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(input).toHaveValue("Intento");

    act(() => anunciarDescarte(""));
    await waitFor(() => expect(input).toHaveValue("Inicial"));
  });

  it("soporta texto multilínea y el commit al perder foco", async () => {
    const onCommit = vi.fn();
    render(
      <DeferredTextField
        label="Notas"
        value="Antes"
        onCommit={onCommit}
        multiline
        rows={2}
      />,
    );
    const user = userEvent.setup();
    const textarea = screen.getByLabelText(/^Notas/);

    await user.clear(textarea);
    await user.type(textarea, "Después");
    expect(onCommit).not.toHaveBeenCalled();
    await user.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("Después");
  });
});
