import { MapPin, Clock, Route, AlertTriangle } from "lucide-react";
import { useTournee } from "@/hooks/useTournee";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { WeekChart } from "@/components/dashboard/WeekChart";
import { TourneeMapWeb } from "@/components/dashboard/TourneeMapWeb";
import { formatDistance, formatDuration } from "@/utils/formatters";

export function DashboardPage() {
  const { tournee, map, isLoading } = useTournee();

  const metrics = tournee?.metrics;

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={MapPin}
          label="Visites aujourd'hui"
          value={metrics?.num_stops ?? 0}
        />
        <MetricCard
          icon={Route}
          label="Distance totale"
          value={metrics ? formatDistance(metrics.total_distance_km) : "—"}
        />
        <MetricCard
          icon={Clock}
          label="Temps de route"
          value={
            metrics ? formatDuration(metrics.total_travel_minutes) : "—"
          }
        />
        <MetricCard
          icon={Clock}
          label="Temps de soins"
          value={
            metrics ? formatDuration(metrics.total_care_minutes) : "—"
          }
        />
      </div>

      {/* Map + schedule */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TourneeMapWeb mapData={map} isLoading={isLoading} />
        </div>
        <div className="lg:col-span-2">
          <TodaySchedule tournee={tournee} isLoading={isLoading} />
        </div>
      </div>

      {/* Inefficiencies */}
      {tournee && tournee.inefficiencies.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="mb-2 flex items-center gap-2 font-medium text-orange-800">
            <AlertTriangle size={18} />
            Points d'attention
          </div>
          <ul className="space-y-1 text-sm text-orange-700">
            {tournee.inefficiencies.map((msg, i) => (
              <li key={i}>- {msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Week chart */}
      <WeekChart />
    </div>
  );
}
