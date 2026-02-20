import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Archive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SectorBadge } from "@/components/shared/SectorBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PatientForm } from "@/components/patients/PatientForm";
import {
  usePatient,
  usePatientAppointments,
  usePatientProtocols,
  useUpdatePatient,
  useDeletePatient,
} from "@/hooks/usePatients";
import { useSectors } from "@/hooks/useSectors";
import { formatDate, formatTime } from "@/utils/formatters";
import type { PatientCreate } from "@/types/models";

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const { data: patient, isLoading } = usePatient(id!);
  const { data: appointmentsData } = usePatientAppointments(id!);
  const { data: protocolsData } = usePatientProtocols(id!);
  const { data: sectorsData } = useSectors();
  const updateMutation = useUpdatePatient();
  const deleteMutation = useDeletePatient();

  const sectors = sectorsData?.items ?? [];
  const appointments = appointmentsData?.items ?? [];
  const protocols = protocolsData?.items ?? [];
  const sector = patient?.sector_id
    ? sectors.find((s) => s.id === patient.sector_id)
    : undefined;

  async function handleUpdate(payload: PatientCreate) {
    if (!id) return;
    await updateMutation.mutateAsync({ id, payload });
    setEditOpen(false);
  }

  async function handleArchive() {
    if (!id) return;
    await deleteMutation.mutateAsync(id);
    navigate("/patients");
  }

  if (isLoading || !patient) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/patients")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <div>
            <h2 className="text-2xl font-bold">
              {patient.last_name} {patient.first_name}
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {patient.city && <span>{patient.city}</span>}
              {sector && (
                <SectorBadge name={sector.name} color={sector.color} />
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Modifier
          </Button>
          <Button variant="outline" onClick={handleArchive}>
            <Archive className="mr-2 h-4 w-4" />
            Archiver
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="appointments">
            Rendez-vous ({appointments.length})
          </TabsTrigger>
          <TabsTrigger value="protocols">
            Protocoles ({protocols.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              <InfoRow label="Adresse" value={patient.address} />
              <InfoRow label="Code postal" value={patient.postal_code} />
              <InfoRow label="Commune" value={patient.city} />
              <InfoRow label="Telephone" value={patient.phone} />
              <InfoRow label="Email" value={patient.email} />
              <InfoRow
                label="Date de naissance"
                value={patient.birth_date ? formatDate(patient.birth_date) : ""}
              />
              <InfoRow
                label="Preference horaire"
                value={
                  patient.preferred_time_slot === "morning"
                    ? "Matin"
                    : patient.preferred_time_slot === "afternoon"
                      ? "Apres-midi"
                      : "Indifferent"
                }
              />
              <InfoRow
                label="Duree soins"
                value={`${patient.care_duration_default} min`}
              />
              {patient.notes && (
                <div className="sm:col-span-2">
                  <InfoRow label="Notes" value={patient.notes} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rendez-vous</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Heure</TableHead>
                    <TableHead>Soin</TableHead>
                    <TableHead>Duree</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell>{formatDate(apt.scheduled_at)}</TableCell>
                      <TableCell>{formatTime(apt.scheduled_at)}</TableCell>
                      <TableCell>{apt.care_type}</TableCell>
                      <TableCell>{apt.duration_minutes} min</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{apt.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="protocols" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Protocoles de soins</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Soin</TableHead>
                    <TableHead>Recurrence</TableHead>
                    <TableHead>Debut</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {protocols.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.care_type}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.recurrence_rule}
                      </TableCell>
                      <TableCell>{formatDate(p.start_date)}</TableCell>
                      <TableCell>
                        {p.end_date ? formatDate(p.end_date) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <PatientForm
        open={editOpen}
        onOpenChange={setEditOpen}
        patient={patient}
        sectors={sectors}
        onSubmit={handleUpdate}
        loading={updateMutation.isPending}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}
