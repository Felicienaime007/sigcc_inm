"use client";

import { RemoteSelect } from "@/components/data/remote-select";
import { libelleEmplacement } from "@/lib/stock";
import type { EmplacementStock, ProduitRef } from "@/types/stock";

export function ProduitSelect({
  value, onChange,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  return (
    <RemoteSelect<ProduitRef>
      path="produits"
      value={value}
      onChange={onChange}
      getValue={(p) => p.id_produit}
      getLabel={(p) => `${p.code_produit} — ${p.designation}`}
      placeholder="Choisir le produit…"
    />
  );
}

export function EmplacementSelect({
  value, onChange,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  return (
    <RemoteSelect<EmplacementStock>
      path="stock/emplacements"
      value={value}
      onChange={onChange}
      getValue={(e) => e.id_emplacement}
      getLabel={libelleEmplacement}
      placeholder="Choisir l'emplacement…"
    />
  );
}

/** Produit imposé par l'écran appelant : affiché, non modifiable. */
export function ProduitFige({ produit }: { produit: ProduitRef }) {
  return (
    <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm">
      {produit.code_produit} — {produit.designation}
    </div>
  );
}