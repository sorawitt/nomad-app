import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import type { Trip } from '../../../../types/models';

export function useTripDetail(tripId: string) {
  return useQuery({
    queryKey: ['trip', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('id, title, start_date, end_date, currency_code, updated_at, owner_id')
        .eq('id', tripId)
        .single();

      if (error) throw error;
      return data as Trip;
    },
    enabled: !!tripId,
  });
}