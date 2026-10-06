"use client";

import { useState } from "react";
import { RequirePrivilege } from "@/components/can";
import { PageHeader } from "@/components/page-header";
import { NiveauTab } from "@/components/territoire/niveau-tab";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { NIVEAUX } from "@/lib/territoire";

export default function TerritoirePage() {
  return (
    <RequirePrivilege privilege={NIVEAUX.map((n) => `${n.priv}.view`)}>
      <Contenu />
    </RequirePrivilege>
  );
}

function Contenu() {
  const { can } = useAuth();
  const visibles = NIVEAUX.filter((n) => can(`${n.priv}.view`));
  const [choix, setChoix] = useState<string | null>(null);
  const actif = visibles.find((n) => n.priv === choix) ?? visibles[0];
  if (!actif) return null;

  return (
    <div>
      <PageHeader
        title="Découpage territorial"
        description="Province → Région → District → Commune → Fokontany. Sert à renseigner l'adresse des clients."
      />

      <Tabs value={actif.priv} onValueChange={setChoix}>
        <TabsList className="h-auto flex-wrap justify-start">
          {visibles.map((n) => (
            <TabsTrigger key={n.priv} value={n.priv}>
              {n.tab}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Un seul onglet monté à la fois : aucune requête inutile sur les autres niveaux */}
      <div className="mt-6">
        <NiveauTab key={actif.priv} cfg={actif} />
      </div>
    </div>
  );
}