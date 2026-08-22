/**
 * Estado de sesion del frontend.
 *
 * La sesion no se guarda en el navegador ni se deduce de la existencia de
 * cookies: se pregunta a `/auth/me`, que es la unica fuente de verdad.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchSession, login, logout } from "@/api/auth";
import type { LoginPayload, SessionUser } from "@/types/auth";

export const SESSION_QUERY_KEY = ["session"] as const;

/**
 * Sesion actual.
 *
 * `data === null` significa "verificado y sin sesion"; `isPending` significa
 * "todavia no se sabe" y debe mostrar un estado de carga, nunca la pantalla de
 * login.
 */
export function useSession() {
  return useQuery<SessionUser | null>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    // Un 401 ya se traduce a null; reintentar solo repetiria fallos de red.
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (user) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      // Se limpia aunque el backend falle: las cookies ya fueron invalidadas y
      // no debe quedar rastro del usuario en memoria.
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      queryClient.clear();
    },
  });
}
