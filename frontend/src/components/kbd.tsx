/** Touche de clavier dans les aides de saisie (F2, F9, Entrée…). */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold">
      {children}
    </kbd>
  );
}
