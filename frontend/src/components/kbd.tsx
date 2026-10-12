/** Touche de clavier dans les aides de saisie (F2, F9, Entrée…). */
export function Kbd({ children, className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={`shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold shadow-[0_1px_0_rgb(0_0_0/0.08)] ${className ?? ""}`}
      {...props}
    >
      {children}
    </kbd>
  );
}
