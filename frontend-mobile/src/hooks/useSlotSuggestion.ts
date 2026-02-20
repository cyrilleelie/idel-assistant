import { useMutation, useQueryClient } from '@tanstack/react-query';
import { suggestSlots, bookSlot } from '../api/slots';
import type { SlotSuggestRequest, SlotBookRequest } from '../types/models';

export function useSlotSuggestion() {
  const queryClient = useQueryClient();

  const suggestMutation = useMutation({
    mutationFn: (params: SlotSuggestRequest) => suggestSlots(params),
  });

  const bookMutation = useMutation({
    mutationFn: (params: SlotBookRequest) => bookSlot(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournee'] });
      queryClient.invalidateQueries({ queryKey: ['tournee-map'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  return {
    suggest: suggestMutation.mutate,
    suggestAsync: suggestMutation.mutateAsync,
    suggestions: suggestMutation.data,
    isSuggesting: suggestMutation.isPending,
    suggestError: suggestMutation.error,
    book: bookMutation.mutate,
    bookAsync: bookMutation.mutateAsync,
    isBooking: bookMutation.isPending,
    bookError: bookMutation.error,
    reset: suggestMutation.reset,
  };
}
