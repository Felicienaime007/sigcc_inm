/** Date du jour au fuseau de Madagascar, au format AAAA-MM-JJ (attendu par les filtres `du` / `au`). */
export function aujourdhui(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Antananarivo" }).format(new Date());
}

export const anneeCourante = () => Number(aujourdhui().slice(0, 4));