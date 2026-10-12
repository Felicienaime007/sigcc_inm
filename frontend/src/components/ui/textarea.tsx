import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground hover:border-muted-foreground/35 focus-visible:border-primary disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 disabled:hover:border-input aria-invalid:border-destructive md:text-sm dark:bg-input/30 dark:hover:border-muted-foreground/40 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
