export function libelleTarifFacturation(t: string): string {
  return t === "VIREMENT_TRESOR" ? "Virement du Trésor (SOA)" : t === "QUITTANCE" ? "Quittance (caisse)" : t;
}