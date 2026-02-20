import { useQuery } from "@tanstack/react-query";
import { getTodayTournee } from "@/api/tournees";
import { format } from "date-fns";

export function useTournee(date?: Date) {
  const dateStr = date ? format(date, "yyyy-MM-dd") : undefined;

  const query = useQuery({
    queryKey: ["tournee", dateStr],
    queryFn: () => getTodayTournee(dateStr),
  });

  return {
    tournee: query.data,
    map: query.data?.map_data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
