import { format, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { DayColumn } from "./DayColumn";
import type { Appointment, Patient, Sector } from "@/types/models";
import { cn } from "@/lib/utils";

const START_HOUR = 7;
const END_HOUR = 19;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const ROW_HEIGHT = 48; // px per hour slot
const GRID_HEIGHT = HOURS.length * ROW_HEIGHT;

interface WeekViewProps {
  days: Date[];
  appointmentsByDay: Map<string, Appointment[]>;
  patients: Map<string, Patient>;
  sectors: Map<string, Sector>;
  onClickSlot?: (date: Date, hour: number) => void;
  onClickAppointment?: (appointment: Appointment) => void;
}

export function WeekView({
  days,
  appointmentsByDay,
  patients,
  sectors,
  onClickSlot,
  onClickAppointment,
}: WeekViewProps) {
  const today = new Date();

  return (
    <div className="flex overflow-auto rounded-lg border bg-card">
      {/* Hour labels */}
      <div className="flex w-14 flex-shrink-0 flex-col border-r">
        <div className="h-10 flex-shrink-0 border-b" />
        <div style={{ height: GRID_HEIGHT }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="flex items-start justify-end pr-2 text-xs text-muted-foreground"
              style={{ height: ROW_HEIGHT }}
            >
              {h}:00
            </div>
          ))}
        </div>
      </div>

      {/* Day columns */}
      <div className="flex flex-1">
        {days.map((date) => {
          const key = format(date, "yyyy-MM-dd");
          const appointments = appointmentsByDay.get(key) ?? [];
          const isToday = isSameDay(date, today);

          return (
            <div key={key} className="flex flex-1 flex-col">
              {/* Day header */}
              <div
                className={cn(
                  "flex h-10 flex-shrink-0 flex-col items-center justify-center border-b text-xs",
                  isToday && "bg-primary/10 font-bold text-primary"
                )}
              >
                <span>{format(date, "EEE", { locale: fr })}</span>
                <span className="text-[10px]">
                  {format(date, "dd/MM")}
                </span>
              </div>

              {/* Time grid — explicit height so absolute children are visible */}
              <div className="relative" style={{ height: GRID_HEIGHT }}>
                {/* Grid lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-b border-dashed border-border/50"
                    style={{
                      top: `${((h - START_HOUR) / (END_HOUR - START_HOUR)) * 100}%`,
                    }}
                  />
                ))}

                <DayColumn
                  appointments={appointments}
                  patients={patients}
                  sectors={sectors}
                  onClickSlot={(hour) => onClickSlot?.(date, hour)}
                  onClickAppointment={onClickAppointment}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
