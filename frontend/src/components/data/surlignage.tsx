"use client";

function sansAccents(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Surligne la partie du texte qui correspond à la recherche
 * (insensible aux accents et à la casse).
 */
export function Surligner({ texte, recherche }: { texte: string; recherche: string }) {
  const f = sansAccents(recherche.trim());
  if (!f) return <>{texte}</>;
  const idx = sansAccents(texte).indexOf(f);
  if (idx < 0) return <>{texte}</>;
  const longueur = recherche.trim().length;
  return (
    <>
      {texte.slice(0, idx)}
      <mark className="rounded-sm bg-[#e8b04a]/45 px-0 text-inherit dark:bg-[#e8b04a]/30">
        {texte.slice(idx, idx + longueur)}
      </mark>
      {texte.slice(idx + longueur)}
    </>
  );
}
