import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Trip } from '../../../types/models';

export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(`
          id,
          title,
          start_date,
          end_date,
          updated_at,
          owner_id
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Trip[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}