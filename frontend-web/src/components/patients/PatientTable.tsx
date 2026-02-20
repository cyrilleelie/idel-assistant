import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
  archived: "Inactif",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-800",
};

type SortColumn = "name" | "city" | "sector" | "status";
type SortDirection = "asc" | "desc";

export function PatientTable({ patients, sectors }: PatientTableProps) {
  const navigate = useNavigate();
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));

  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  const sortedPatients = useMemo(() => {
    return [...patients].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "name":
          cmp = `${a.last_name} ${a.first_name}`.localeCompare(
            `${b.last_name} ${b.first_name}`,
            "fr"
          );
          break;
        case "city":
          cmp = (a.city || "").localeCompare(b.city || "", "fr");
          break;
        case "sector": {
          const sa = a.sector_id ? sectorMap.get(a.sector_id)?.name || "" : "";
          const sb = b.sector_id ? sectorMap.get(b.sector_id)?.name || "" : "";
          cmp = sa.localeCompare(sb, "fr");
          break;
        }
        case "status":
          cmp = (statusLabels[a.status] || a.status).localeCompare(
            statusLabels[b.status] || b.status,
            "fr"
          );
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [patients, sortColumn, sortDirection, sectorMap]);

  function SortIcon({ column }: { column: SortColumn }) {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead
            className="cursor-pointer select-none"
            onClick={() => handleSort("name")}
          >
            Nom <SortIcon column="name" />
          </TableHead>
          <TableHead
            className="cursor-pointer select-none"
            onClick={() => handleSort("city")}
          >
            Commune <SortIcon column="city" />
          </TableHead>
          <TableHead
            className="cursor-pointer select-none"
            onClick={() => handleSort("sector")}
          >
            Secteur <SortIcon column="sector" />
          </TableHead>
          <TableHead
            className="cursor-pointer select-none"
            onClick={() => handleSort("status")}
          >
            Statut <SortIcon column="status" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedPatients.map((patient) => {
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
