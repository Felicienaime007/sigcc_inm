"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/contexte";

export function SearchInput({
  value, onChange, placeholder, id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const { t } = useT();
  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t("commun.rechercher")}
        className="pl-8"
      />
    </div>
  );
}