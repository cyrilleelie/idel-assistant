import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TourneeDetail } from "@/types/models";
import { formatTime } from "@/utils/formatters";

interface TodayScheduleProps {
  tournee: TourneeDetail | undefined;
  isLoading: boolean;
}

export function TodaySchedule({ tournee, isLoading }: TodayScheduleProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planning du jour</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  const stops = tournee?.map_data?.stops ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock size={18} />
          Planning du jour
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stops.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun rendez-vous aujourd'hui
          </p>
        ) : (
          stops.slice(0, 6).map((stop, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-md border p-2"
            >
              <span className="text-sm font-medium tabular-nums">
                {formatTime(stop.time)}
              </span>
              <div className="flex-1 text-sm">
                <p className="font-medium">{stop.patient_name}</p>
                <p className="text-muted-foreground">{stop.care_type}</p>
              </div>
              {stop.sector_name && (
                <Badge
                  variant="outline"
                  style={{
                    borderColor: stop.sector_color,
                    color: stop.sector_color,
                  }}
                >
                  {stop.sector_name}
                </Badge>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
