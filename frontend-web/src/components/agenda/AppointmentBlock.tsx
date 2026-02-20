import type { Appointment } from "@/types/models";
import { formatTime } from "@/utils/formatters";

interface AppointmentBlockProps {
  appointment: Appointment;
  topPercent: number;
  heightPercent: number;
  color: string;
  patientName?: string;
  isArchived?: boolean;
  onClick?: () => void;
}

export function AppointmentBlock({
  appointment,
  topPercent,
  heightPercent,
  color,
  patientName,
  isArchived,
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
      <p className="truncate font-medium" style={{ color: isArchived ? "#9ca3af" : color }}>
        <span className={isArchived ? "italic" : ""}>
          {patientName || appointment.patient_id.slice(0, 8)}
        </span>
        {isArchived && (
          <span className="ml-1 rounded bg-red-100 px-1 text-[9px] text-red-600 font-normal not-italic">
            inactif
          </span>
        )}
      </p>
      <p className="truncate text-muted-foreground">
        {formatTime(appointment.scheduled_at)} - {appointment.care_type}
      </p>
    </div>
  );
}
