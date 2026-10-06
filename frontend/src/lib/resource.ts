import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "./api";
import { getErrorMessage } from "./errors";
import type { Paginated } from "@/types/api";

export type Params = Record<string, string | number | boolean | null | undefined>;

function nettoyer(params: Params): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  ) as Record<string, string | number | boolean>;
}

/** Liste paginée. `path` sans slash : "produits/categories", "clients/clients"... */
export function useList<T>(
  path: string,
  params: Params = {},
  enabled = true,
  opts: { refetchInterval?: number | false } = {},
) {
  const p = nettoyer(params);
  return useQuery({
    queryKey: [path, "list", p],
    queryFn: async () => (await api.get<Paginated<T>>(`/${path}/`, { params: p })).data,
    placeholderData: keepPreviousData, // pas de clignotement entre deux pages
    enabled,
    refetchInterval: opts.refetchInterval,
  });
}

/** Toutes les lignes (pour les listes déroulantes) : jusqu'à 1000 éléments. */
export function useOptions<T>(path: string, params: Params = {}, enabled = true) {
  const p = nettoyer({ ...params, page_size: 1000 });
  return useQuery({
    queryKey: [path, "options", p],
    queryFn: async () => (await api.get<Paginated<T>>(`/${path}/`, { params: p })).data.results,
    staleTime: 60_000,
    enabled,
  });
}

/** Un enregistrement par son identifiant. */
export function useDetail<T>(path: string, id: number | string | null | undefined) {
  return useQuery({
    queryKey: [path, "detail", id],
    queryFn: async () => (await api.get<T>(`/${path}/${id}/`)).data,
    enabled: id !== null && id !== undefined && id !== "",
  });
}

/**
 * Mutation générique. Après succès, tous les caches sont invalidés : une écriture
 * peut modifier d'autres écrans (solde de ligne budgétaire, stock, statut de facture...).
 */
export function useApiMutation<TData, TVars>(
  fn: (vars: TVars) => Promise<TData>,
  opts: { success?: string; silentError?: boolean } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries();
      if (opts.success) toast.success(opts.success);
    },
    onError: (e) => {
      if (!opts.silentError) toast.error(getErrorMessage(e));
    },
  });
}

/**
 * CRUD d'une ressource. Création et modification laissent le formulaire afficher
 * les erreurs (silentError) ; la suppression affiche l'erreur (ex. 409) en notification.
 */
export function useCrud<T, TBody = Partial<T>>(path: string) {
  const create = useApiMutation(
    async (body: TBody) => (await api.post<T>(`/${path}/`, body)).data,
    { success: "Enregistrement effectué.", silentError: true },
  );
  const update = useApiMutation(
    async ({ id, body }: { id: number | string; body: Partial<TBody> }) =>
      (await api.patch<T>(`/${path}/${id}/`, body)).data,
    { success: "Modification enregistrée.", silentError: true },
  );
  const remove = useApiMutation(
    async (id: number | string) => {
      await api.delete(`/${path}/${id}/`);
    },
    { success: "Suppression effectuée." },
  );
  return { create, update, remove };
}

/** Action métier sur un enregistrement : POST /<path>/<id>/<action>/ (valider, annuler...). */
export function useRecordAction(path: string, action: string, success?: string) {
  return useApiMutation(
    async ({ id, body }: { id: number | string; body?: unknown }) =>
      (await api.post(`/${path}/${id}/${action}/`, body ?? {})).data,
    { success },
  );
}