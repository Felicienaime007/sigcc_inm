"use client";

import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { useDebounce } from "./use-debounce";
import { useList, type Params } from "@/lib/resource";

interface Options {
  pageSize?: number;
  ordering?: string;      // tri initial, ex. "nom_client" ou "-date_commande"
  params?: Params;        // paramètres fixes (ex. { statut: "VALIDEE" })
  enabled?: boolean;
  refetchInterval?: number | false; // réactualisation auto (ex. files d'attente magasin)
}

/** Page + recherche + tri + filtres + requête, en un seul hook. */
export function usePagedList<T>(path: string, opts: Options = {}) {
  const pageSize = opts.pageSize ?? 20;
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [ordering, setOrderingState] = useState(opts.ordering ?? "");
  const [filters, setFilters] = useState<Params>({});
  const search = useDebounce(searchInput, 300);

  const query = useList<T>(
    path,
    { page, page_size: pageSize, search, ordering, ...filters, ...opts.params },
    opts.enabled,
    { refetchInterval: opts.refetchInterval },
  );

  // Nouvelle recherche : retour à la première page (ajustement pendant le rendu,
  // pattern React recommandé : pas de setState synchrone dans un effet)
  const [prevSearch, setPrevSearch] = useState(search);
  if (prevSearch !== search) {
    setPrevSearch(search);
    setPage(1);
  }

  // Dernière ligne d'une page supprimée : la page n'existe plus (404), on recule
  // d'une page. Synchro légitime avec un système externe (réponse de l'API).
  const pageEnErreur404 =
    page > 1 && isAxiosError(query.error) && query.error.response?.status === 404;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pageEnErreur404) setPage((p) => Math.max(1, p - 1));
  }, [pageEnErreur404]);

  const setOrdering = useCallback((valeur: string) => {
    setOrderingState(valeur);
    setPage(1);
  }, []);

  const setFilter = useCallback((cle: string, valeur: string | number | boolean | null) => {
    setFilters((f) => ({ ...f, [cle]: valeur }));
    setPage(1);
  }, []);

  return {
    query, page, setPage, pageSize,
    searchInput, setSearchInput,
    ordering, setOrdering,
    filters, setFilter,
  };
}