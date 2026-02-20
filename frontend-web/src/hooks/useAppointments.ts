import { useQuery } from "@tanstack/react-query";
import { listAppointments } from "@/api/appointments";

export function useAppointments(params?: {
  patient_id?: string;
  date?: string;
  status?: string;
  skip?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["appointments", params],
    queryFn: () => listAppointments(params),
  });
}
