import type { Appointment } from "@/types/models";
import { formatTime } from "@/utils/formatters";

interface AppointmentBlockProps {
  appointment: Appointment;
  topPercent: number;
  heightPercent: number;
  color: string;
  patientName?: string;
  onClick?: () => void;
}

export function AppointmentBlock({
  appointment,
  topPercent,
  heightPercent,
  color,
  patientName,
  onClick,
}: AppointmentBlockProps) {
  return (
    <div
      className="absolute left-1 right-1 cursor-pointer overflow-hidden rounded-md border px-2 py-1 text-xs transition-opacity hover:opacity-90"
      style={{
        top: `${topPercent}%`,
        height: `${Math.max(heightPercent, 2)}%`,
        backgroundColor: `${color}20`,
        borderColor: color,
        borderLeftWidth: "3px",
      }}
      onClick={onClick}
    >
      <p className="truncate font-medium" style={{ color }}>
        {patientName || appointment.patient_id.slice(0, 8)}
      </p>
      <p className="truncate text-muted-foreground">
        {formatTime(appointment.scheduled_at)} - {appointment.care_type}
      </p>
    </div>
  );
}
