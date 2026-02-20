import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSectors,
  createSector,
  updateSector,
  deleteSector,
} from "@/api/sectors";
import type { SectorCreate, SectorUpdate } from "@/types/models";

export function useSectors() {
  return useQuery({
    queryKey: ["sectors"],
    queryFn: listSectors,
  });
}

export function useCreateSector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SectorCreate) => createSector(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
    },
  });
}

export function useUpdateSector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SectorUpdate }) =>
      updateSector(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
    },
  });
}

export function useDeleteSector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSector(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sectors"] });
    },
  });
}
