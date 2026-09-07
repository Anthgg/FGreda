/**
 * Usuarios de la casa (Fase 009K.2).
 *
 * Un usuario vive partido en dos: la CUENTA en Supabase Auth —de donde sale el
 * correo, y donde vive la contraseña— y el PERFIL, que dice cómo se llama, qué
 * rol tiene y si sigue activo. Esta pantalla administra el perfil y pide el
 * alta de la cuenta; nunca ve una contraseña de vuelta.
 *
 * No hay borrar. Quien ya firmó documentos no se puede quitar sin romper el
 * historial: la baja es desactivar, y una persona desactivada deja de entrar
 * pero sigue apareciendo en lo que hizo.
 */

import { useState } from "react";

import { SelectField } from "@/components/SelectField";
import { Spinner } from "@/components/Spinner";
import { PrimaryButton, SecondaryButton, TextField } from "@/components/form";
import { describeError } from "@/features/settings/messages";
import {
  useCreateUser,
  useSetUserActive,
  useUpdateUser,
  useUsers,
} from "@/features/settings/useSettings";
import type { AppUser, UserRole } from "@/types/settings";

const ROLES: readonly { value: UserRole; label: string }[] = [
  { value: "ADMIN", label: "Administrador" },
  { value: "OPERATOR", label: "Operario" },
];

const ETIQUETA_ROL: Record<UserRole, string> = {
  ADMIN: "Administrador",
  OPERATOR: "Operario",
};

/** Lo que Supabase exige como mínimo. Se avisa antes de enviar, no después. */
const MINIMO_CONTRASENA = 8;

function EstadoBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-block rounded-lg px-2 py-0.5 text-[11px] font-semibold",
        active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500",
      ].join(" ")}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

interface FormularioProps {
  onClose: () => void;
}

function NuevoUsuario({ onClose }: FormularioProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("OPERATOR");
  const [password, setPassword] = useState("");
  const crear = useCreateUser();

  const nombreVacio = !displayName.trim();
  const claveCorta = password.length > 0 && password.length < MINIMO_CONTRASENA;
  const listo = !nombreVacio && email.trim().length > 0 && password.length >= MINIMO_CONTRASENA;

  return (
    <form
      className="space-y-5 rounded-2xl border border-black/[0.04] bg-white/60 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!listo) return;
        crear.mutate(
          { display_name: displayName.trim(), email: email.trim(), role, password },
          { onSuccess: onClose },
        );
      }}
    >
      <h3 className="text-sm font-semibold text-zinc-950">Nuevo usuario</h3>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Nombre visible"
          requirement="required"
          value={displayName}
          onChange={setDisplayName}
          disabled={crear.isPending}
          hint="Es el nombre que aparecerá en los documentos que emita."
          error={nombreVacio && displayName.length > 0 ? "Escriba un nombre." : undefined}
        />
        <TextField
          label="Correo"
          requirement="required"
          type="email"
          value={email}
          onChange={setEmail}
          disabled={crear.isPending}
          hint="Con este correo iniciará sesión. No se puede cambiar después."
        />
        <SelectField
          label="Rol"
          requirement="required"
          value={role}
          options={ROLES}
          onChange={setRole}
          disabled={crear.isPending}
        />
        {/* La contraseña viaja de ida y nunca vuelve: no se guarda aquí, no se
            muestra en ninguna pantalla y no aparece en ninguna respuesta. */}
        <TextField
          label="Contraseña inicial"
          requirement="required"
          type="password"
          value={password}
          onChange={setPassword}
          disabled={crear.isPending}
          hint={`Mínimo ${MINIMO_CONTRASENA} caracteres. Comuníquela por un canal seguro.`}
          error={claveCorta ? `Use al menos ${MINIMO_CONTRASENA} caracteres.` : undefined}
        />
      </div>

      {crear.isError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
        >
          {describeError(crear.error)}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <SecondaryButton type="button" onClick={onClose} disabled={crear.isPending}>
          Cancelar
        </SecondaryButton>
        <PrimaryButton disabled={!listo || crear.isPending}>
          {crear.isPending ? "Creando…" : "Crear usuario"}
        </PrimaryButton>
      </div>
    </form>
  );
}

function EditarUsuario({ usuario, onClose }: { usuario: AppUser } & FormularioProps) {
  const [displayName, setDisplayName] = useState(usuario.display_name);
  const [role, setRole] = useState<UserRole>(usuario.role);
  const editar = useUpdateUser();

  const nombreVacio = !displayName.trim();

  return (
    <form
      className="space-y-5 rounded-2xl border border-black/[0.04] bg-white/60 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (nombreVacio) return;
        editar.mutate(
          { id: usuario.id, payload: { display_name: displayName.trim(), role } },
          { onSuccess: onClose },
        );
      }}
    >
      <h3 className="text-sm font-semibold text-zinc-950">
        Editar {usuario.display_name}
      </h3>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Nombre visible"
          requirement="required"
          value={displayName}
          onChange={setDisplayName}
          disabled={editar.isPending}
          error={nombreVacio ? "Escriba un nombre." : undefined}
          hint="Los documentos ya emitidos conservan el nombre con el que se firmaron."
        />
        <SelectField
          label="Rol"
          requirement="required"
          value={role}
          options={ROLES}
          onChange={setRole}
          disabled={editar.isPending}
        />
        {/* El correo se enseña, no se edita: su autoridad es Supabase Auth y
            cambiarlo es cambiar la credencial, no el nombre de una persona. */}
        <TextField
          label="Correo"
          value={usuario.email ?? ""}
          onChange={() => undefined}
          readOnly
          hint="El correo no se cambia desde aquí."
        />
      </div>

      {editar.isError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
        >
          {describeError(editar.error)}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <SecondaryButton type="button" onClick={onClose} disabled={editar.isPending}>
          Cancelar
        </SecondaryButton>
        <PrimaryButton disabled={nombreVacio || editar.isPending}>
          {editar.isPending ? "Guardando…" : "Guardar cambios"}
        </PrimaryButton>
      </div>
    </form>
  );
}

export function UsersSection({ canEdit }: { canEdit: boolean }) {
  const query = useUsers(canEdit);
  const estado = useSetUserActive();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <p className="text-sm text-zinc-500">
        La administración de usuarios está reservada a los administradores.
      </p>
    );
  }

  if (query.isPending) {
    return (
      <div className="py-8 text-center text-xs text-zinc-400">
        <Spinner className="size-5" label="Cargando usuarios..." />
      </div>
    );
  }

  if (query.isError) {
    return (
      <p
        role="alert"
        className="rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-xs text-red-700"
      >
        {describeError(query.error)}
      </p>
    );
  }

  const enEdicion = query.data.items.find((u) => u.id === editando) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          Quién puede entrar y con qué rol. Desactivar cierra el acceso sin borrar el
          historial.
        </p>
        {!creando && !enEdicion ? (
          <PrimaryButton type="button" onClick={() => setCreando(true)}>
            Nuevo usuario
          </PrimaryButton>
        ) : null}
      </div>

      {creando ? <NuevoUsuario onClose={() => setCreando(false)} /> : null}
      {enEdicion ? (
        <EditarUsuario usuario={enEdicion} onClose={() => setEditando(null)} />
      ) : null}

      {estado.isError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
        >
          {describeError(estado.error)}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-black/[0.04] bg-white/40 shadow-2xs">
        <table className="w-full min-w-[42rem] text-xs text-left">
          <thead>
            <tr className="border-b border-black/[0.04] bg-black/[0.02] text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.03]">
            {query.data.items.map((usuario) => (
              <tr key={usuario.id} className="hover:bg-white/60 transition-colors">
                <td className="px-4 py-3 font-semibold text-zinc-900">
                  {usuario.display_name}
                </td>
                {/* Sin correo cuando el perfil existe y la cuenta no. Se
                    enseña el hueco en vez de esconder la fila. */}
                <td className="px-4 py-3 text-zinc-600">
                  {usuario.email ?? <span className="text-zinc-300">—</span>}
                </td>
                <td className="px-4 py-3 text-zinc-600">{ETIQUETA_ROL[usuario.role]}</td>
                <td className="px-4 py-3">
                  <EstadoBadge active={usuario.active} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        setCreando(false);
                        setEditando(usuario.id);
                      }}
                    >
                      Editar
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      disabled={estado.isPending}
                      onClick={() =>
                        estado.mutate({ id: usuario.id, active: !usuario.active })
                      }
                    >
                      {usuario.active ? "Desactivar" : "Reactivar"}
                    </SecondaryButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-zinc-400 text-right">
        {query.data.total} {query.data.total === 1 ? "usuario" : "usuarios"}.
      </p>
    </div>
  );
}
