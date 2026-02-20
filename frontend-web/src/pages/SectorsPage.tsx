import { useState } from "react";
import { Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SectorMap } from "@/components/sectors/SectorMap";
import { SectorList } from "@/components/sectors/SectorList";
import { SectorForm } from "@/components/sectors/SectorForm";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  useSectors,
  useCreateSector,
  useUpdateSector,
  useDeleteSector,
} from "@/hooks/useSectors";
import { usePatients } from "@/hooks/usePatients";
import type { Sector, SectorCreate } from "@/types/models";

export function SectorsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | undefined>();
  const [deletingSector, setDeletingSector] = useState<Sector | null>(null);

  const { data: sectorsData, isLoading: sectorsLoading } = useSectors();
  const { data: patientsData } = usePatients({ limit: 100 });
  const createMutation = useCreateSector();
  const updateMutation = useUpdateSector();
  const deleteMutation = useDeleteSector();

  const sectors = sectorsData?.items ?? [];
  const patients = patientsData?.items ?? [];

  function handleOpenCreate() {
    setEditingSector(undefined);
    setFormOpen(true);
  }

  function handleOpenEdit(sector: Sector) {
    setEditingSector(sector);
    setFormOpen(true);
  }

  async function handleSubmit(data: SectorCreate) {
    if (editingSector) {
      await updateMutation.mutateAsync({ id: editingSector.id, payload: data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setFormOpen(false);
    setEditingSector(undefined);
  }

  async function handleDelete() {
    if (!deletingSector) return;
    await deleteMutation.mutateAsync(deletingSector.id);
    setDeletingSector(null);
  }

  if (sectorsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {sectors.length} secteur{sectors.length > 1 ? "s" : ""}
        </h2>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau secteur
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Map */}
        <div className="lg:col-span-3">
          <SectorMap patients={patients} sectors={sectors} />
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          {sectors.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Aucun secteur"
              description="Creez des secteurs pour organiser vos visites"
              actionLabel="Creer un secteur"
              onAction={handleOpenCreate}
            />
          ) : (
            <SectorList
              sectors={sectors}
              patients={patients}
              onEdit={handleOpenEdit}
              onDelete={setDeletingSector}
            />
          )}
        </div>
      </div>

      {/* Create/Edit form */}
      <SectorForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingSector(undefined);
        }}
        sector={editingSector}
        existingCount={sectors.length}
        onSubmit={handleSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete confirmation */}
      <Dialog
        open={!!deletingSector}
        onOpenChange={(open) => !open && setDeletingSector(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le secteur</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Voulez-vous vraiment supprimer le secteur "{deletingSector?.name}" ?
            Les patients associes ne seront pas supprimes mais perdront leur
            affectation de secteur.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingSector(null)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
