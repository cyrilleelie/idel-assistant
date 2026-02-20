import { useState, useMemo } from "react";
import {
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  format,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { WeekView } from "@/components/agenda/WeekView";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { listAppointments } from "@/api/appointments";
import { usePatients } from "@/hooks/usePatients";
import { useSectors } from "@/hooks/useSectors";
import { useSlotSuggestion } from "@/hooks/useSlotSuggestion";
import {
  formatTime,
  formatDistance,
  formatDuration,
} from "@/utils/formatters";
import type { Appointment, Patient, Sector } from "@/types/models";

const DAYS_IN_WEEK = 6; // Mon-Sat

export function AgendaPage() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [_selectedDate, _setSelectedDate] = useState<Date | null>(null);
  const queryClient = useQueryClient();

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_IN_WEEK }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Fetch appointments for each day in parallel
  const dayQueries = useQueries({
    queries: days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      return {
        queryKey: ["appointments", { date: dateStr }],
        queryFn: () =>
          listAppointments({
            date: dateStr,
            limit: 50,
          }),
      };
    }),
  });

  // Fetch patients and sectors for name/color display
  const { data: patientsData, isLoading: patientsLoading } = usePatients({ limit: 100 });
  const { data: sectorsData } = useSectors();

  const isLoading = dayQueries.some((q) => q.isLoading) || patientsLoading;

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    days.forEach((date, i) => {
      const key = format(date, "yyyy-MM-dd");
      const items = dayQueries[i].data?.items ?? [];
      map.set(key, items);
    });
    return map;
  }, [days, dayQueries]);

  const patientsMap = useMemo(() => {
    const map = new Map<string, Patient>();
    patientsData?.items.forEach((p) => map.set(p.id, p));
    return map;
  }, [patientsData]);

  const sectorsMap = useMemo(() => {
    const map = new Map<string, Sector>();
    sectorsData?.items.forEach((s) => map.set(s.id, s));
    return map;
  }, [sectorsData]);

  const { suggestions, isSuggesting, suggest, book, isBooking, reset } =
    useSlotSuggestion();

  function handleClickSlot(date: Date, _hour: number) {
    _setSelectedDate(date);
    setSuggestionOpen(true);
  }

  function handlePrev() {
    setWeekStart(subWeeks(weekStart, 1));
  }
  function handleNext() {
    setWeekStart(addWeeks(weekStart, 1));
  }
  function handleToday() {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  }

  const weekLabel = `${format(days[0], "dd MMM", { locale: fr })} - ${format(
    days[days.length - 1],
    "dd MMM yyyy",
    { locale: fr }
  )}`;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Aujourd'hui
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          Vue semaine
        </div>
      </div>

      {/* Week grid */}
      <div className="flex-1 min-h-[500px]">
        {isLoading ? (
          <LoadingSpinner className="h-full" />
        ) : (
          <WeekView
            days={days}
            appointmentsByDay={appointmentsByDay}
            patients={patientsMap}
            sectors={sectorsMap}
            onClickSlot={handleClickSlot}
            onClickAppointment={setSelectedAppointment}
          />
        )}
      </div>

      {/* Appointment detail dialog */}
      <Dialog
        open={!!selectedAppointment}
        onOpenChange={(open) => !open && setSelectedAppointment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail du rendez-vous</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Patient</span>
                <span className="font-medium">
                  {(() => {
                    const p = patientsMap.get(selectedAppointment.patient_id);
                    return p
                      ? `${p.last_name} ${p.first_name}`
                      : "Patient inconnu";
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Heure</span>
                <span>{formatTime(selectedAppointment.scheduled_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Soin</span>
                <span>{selectedAppointment.care_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duree</span>
                <span>{selectedAppointment.duration_minutes} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Statut</span>
                <Badge variant="secondary">
                  {selectedAppointment.status}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Suggestion dialog */}
      <Dialog
        open={suggestionOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSuggestionOpen(false);
            reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Suggestion de creneau</DialogTitle>
          </DialogHeader>

          {!suggestions && !isSuggesting && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Pour proposer un creneau, utilisez le formulaire de suggestion depuis la fiche d'un patient (page Patients).
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSuggestionOpen(false)}
                >
                  Fermer
                </Button>
                <Button
                  onClick={() => {
                    setSuggestionOpen(false);
                    window.location.href = "/patients";
                  }}
                >
                  Aller aux patients
                </Button>
              </DialogFooter>
            </div>
          )}

          {isSuggesting && <LoadingSpinner />}

          {suggestions && (
            <div className="space-y-3">
              {suggestions.suggestions.map((slot) => (
                <div
                  key={slot.rank}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Detour: {formatDistance(slot.detour_km)} ({formatDuration(slot.detour_minutes)})
                      {slot.same_sector && " - Meme secteur"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {slot.explanation}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{Math.round(slot.score * 100)}%</Badge>
                    <Button
                      size="sm"
                      disabled={isBooking}
                      onClick={() => {
                        book({
                          patient_id: "",
                          care_type: "",
                          duration_minutes: 30,
                          start_time: slot.start_time,
                          date: suggestions.day_summary.date,
                        });
                        setSuggestionOpen(false);
                        queryClient.invalidateQueries({
                          queryKey: ["appointments"],
                        });
                      }}
                    >
                      Reserver
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
