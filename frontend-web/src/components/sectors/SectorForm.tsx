import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Sector, SectorCreate } from "@/types/models";
import { getSectorColor } from "@/utils/colors";

interface SectorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sector?: Sector;
  existingCount: number;
  onSubmit: (data: SectorCreate) => void;
  loading?: boolean;
}

export function SectorForm({
  open,
  onOpenChange,
  sector,
  existingCount,
  onSubmit,
  loading,
}: SectorFormProps) {
  const [name, setName] = useState(sector?.name ?? "");
  const [postalCodes, setPostalCodes] = useState(
    sector?.postal_codes.join(", ") ?? ""
  );
  const [communes, setCommunes] = useState(
    sector?.communes.join(", ") ?? ""
  );
  const [color, setColor] = useState(
    sector?.color ?? getSectorColor(existingCount)
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      postal_codes: postalCodes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      communes: communes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      color,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {sector ? "Modifier le secteur" : "Nouveau secteur"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sectorName">Nom *</Label>
            <Input
              id="sectorName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postalCodes">
              Codes postaux (separes par des virgules)
            </Label>
            <Input
              id="postalCodes"
              value={postalCodes}
              onChange={(e) => setPostalCodes(e.target.value)}
              placeholder="44000, 44100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="communes">
              Communes (separees par des virgules)
            </Label>
            <Input
              id="communes"
              value={communes}
              onChange={(e) => setCommunes(e.target.value)}
              placeholder="Nantes, Reze"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Couleur</Label>
            <div className="flex items-center gap-3">
              <input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border"
              />
              <span className="text-sm text-muted-foreground">{color}</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
