import { Badge } from "@/components/ui/badge";
import { estSoa, libelleType } from "@/lib/clients";

export function TypeBadge({ type }: { type: string }) {
  return <Badge variant={estSoa(type) ? "secondary" : "outline"}>{libelleType(type)}</Badge>;
}