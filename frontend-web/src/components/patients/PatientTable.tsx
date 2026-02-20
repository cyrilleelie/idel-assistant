import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectorBadge } from "@/components/shared/SectorBadge";
import type { Patient, Sector } from "@/types/models";

interface PatientTableProps {
  patients: Patient[];
  sectors: Sector[];
}

const statusLabels: Record<string, string> = {
  active: "Actif",
  inactive: "Inactif",
  archived: "Archive",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  archived: "bg-red-100 text-red-800",
};

export function PatientTable({ patients, sectors }: PatientTableProps) {
  const navigate = useNavigate();
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Commune</TableHead>
          <TableHead>Secteur</TableHead>
          <TableHead>Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {patients.map((patient) => {
          const sector = patient.sector_id
            ? sectorMap.get(patient.sector_id)
            : undefined;
          return (
            <TableRow
              key={patient.id}
              className="cursor-pointer"
              onClick={() => navigate(`/patients/${patient.id}`)}
            >
              <TableCell className="font-medium">
                {patient.last_name} {patient.first_name}
              </TableCell>
              <TableCell>{patient.city || "—"}</TableCell>
              <TableCell>
                {sector ? (
                  <SectorBadge name={sector.name} color={sector.color} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={statusColors[patient.status] ?? ""}>
                  {statusLabels[patient.status] ?? patient.status}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
