import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

type CreateTripInput = {
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  currency_code?: string;
};

type CreateTripResult = string;

export function useCreateTrip() {
  const queryClient = useQueryClient();

  return useMutation<CreateTripResult, Error, CreateTripInput>({
    mutationFn: async (input: CreateTripInput) => {
      // Call Supabase RPC to create trip + days
      const { data, error } = await supabase.rpc('create_trip_with_days', {
        p_title: input.title,
        p_start_date: input.start_date,
        p_end_date: input.end_date,
        p_currency_code: input.currency_code || 'THB',
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate trips list
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}