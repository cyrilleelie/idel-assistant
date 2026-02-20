import { Badge } from "@/components/ui/badge";

interface SectorBadgeProps {
  name: string;
  color: string;
}

export function SectorBadge({ name, color }: SectorBadgeProps) {
  return (
    <Badge
      variant="outline"
      style={{
        borderColor: color,
        color: color,
        backgroundColor: `${color}15`,
      }}
    >
      {name}
    </Badge>
  );
}
