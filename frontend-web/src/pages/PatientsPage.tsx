import { useState, useMemo, useEffect } from "react";
import { Plus, Search, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PatientTable } from "@/components/patients/PatientTable";
import { PatientForm } from "@/components/patients/PatientForm";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { usePatients, useCreatePatient } from "@/hooks/usePatients";
import { useSectors } from "@/hooks/useSectors";
import type { PatientCreate } from "@/types/models";

const PAGE_SIZE = 20;

export function PatientsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, sectorFilter, statusFilter]);

  const queryParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      sector_id: sectorFilter !== "all" ? sectorFilter : undefined,
      status: statusFilter,
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, sectorFilter, statusFilter, page]
  );

  const { data, isLoading } = usePatients(queryParams);
  const { data: sectorsData } = useSectors();
  const createMutation = useCreatePatient();

  const sectors = sectorsData?.items ?? [];
  const patients = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  async function handleCreate(payload: PatientCreate) {
    await createMutation.mutateAsync(payload);
    setFormOpen(false);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un patient..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sectorFilter} onValueChange={setSectorFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Secteur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les secteurs</SelectItem>
            {sectors.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="archived">Inactif</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau patient
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingSpinner />
          ) : patients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aucun patient"
              description="Ajoutez votre premier patient pour commencer"
              actionLabel="Ajouter un patient"
              onAction={() => setFormOpen(true)}
            />
          ) : (
            <PatientTable patients={patients} sectors={sectors} />
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} patient{total > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Precedent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Create dialog */}
      <PatientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        sectors={sectors}
        onSubmit={handleCreate}
        loading={createMutation.isPending}
      />
    </div>
  );
}
