import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

export type Trip = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  updated_at: string;
  owner_id: string;
  activity_count?: number;
};

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
          owner_id,
          activities(count)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return data.map((trip) => ({
        ...trip,
        activity_count: trip.activities?.[0]?.count ?? 0,
      })) as Trip[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}