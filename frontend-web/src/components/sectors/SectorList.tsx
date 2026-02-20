import { Edit, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Sector, Patient } from "@/types/models";

interface SectorListProps {
  sectors: Sector[];
  patients: Patient[];
  onEdit: (sector: Sector) => void;
  onDelete: (sector: Sector) => void;
}

export function SectorList({
  sectors,
  patients,
  onEdit,
  onDelete,
}: SectorListProps) {
  function countPatients(sectorId: string): number {
    return patients.filter((p) => p.sector_id === sectorId).length;
  }

  return (
    <div className="space-y-3">
      {sectors.map((sector) => (
        <Card key={sector.id}>
          <CardContent className="flex items-center gap-4 p-4">
            <div
              className="h-10 w-10 rounded-full flex-shrink-0"
              style={{ backgroundColor: sector.color }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{sector.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {sector.communes.length > 0
                  ? sector.communes.join(", ")
                  : sector.postal_codes.join(", ")}
              </p>
            </div>
            <Badge variant="secondary">
              {countPatients(sector.id)} patients
            </Badge>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(sector)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(sector)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
