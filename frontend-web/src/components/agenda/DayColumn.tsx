import { parseISO, getHours, getMinutes } from "date-fns";
import { AppointmentBlock } from "./AppointmentBlock";
import type { Appointment, Patient, Sector } from "@/types/models";
import { getSectorColor } from "@/utils/colors";

const START_HOUR = 7;
const END_HOUR = 19;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

interface DayColumnProps {
  appointments: Appointment[];
  patients: Map<string, Patient>;
  sectors: Map<string, Sector>;
  onClickSlot?: (hour: number) => void;
  onClickAppointment?: (appointment: Appointment) => void;
}

export function DayColumn({
  appointments,
  patients,
  sectors,
  onClickSlot,
  onClickAppointment,
}: DayColumnProps) {
  function getPosition(isoDate: string) {
    const date = parseISO(isoDate);
    const h = getHours(date);
    const m = getMinutes(date);
    const minutesFromStart = (h - START_HOUR) * 60 + m;
    return (minutesFromStart / TOTAL_MINUTES) * 100;
  }

  return (
    <div
      className="absolute inset-0"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const pct = y / rect.height;
        const hour = Math.floor(START_HOUR + pct * (END_HOUR - START_HOUR));
        onClickSlot?.(hour);
      }}
    >
      {appointments.map((apt, i) => {
        const patient = patients.get(apt.patient_id);
        const sector = patient?.sector_id
          ? sectors.get(patient.sector_id)
          : undefined;
        const color = sector?.color ?? getSectorColor(i);
        const topPct = getPosition(apt.scheduled_at);
        const heightPct = (apt.duration_minutes / TOTAL_MINUTES) * 100;

        return (
          <AppointmentBlock
            key={apt.id}
            appointment={apt}
            topPercent={topPct}
            heightPercent={heightPct}
            color={color}
            patientName={
              patient
                ? `${patient.last_name} ${patient.first_name}`
                : undefined
            }
            onClick={() => onClickAppointment?.(apt)}
          />
        );
      })}
    </div>
  );
}
