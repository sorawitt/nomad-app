import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';

export type TripDay = {
  id: string;
  title: string;
  trip_id: string;
  day_index: number;
  date: string;
};

const getTripDays = async (tripId: string, limit: number) => {
  const { data, error } = await supabase
    .from('trip_days')
    .select(`
      id,
      title,
      trip_id,
      day_index,
      date
    `)
    .eq('trip_id', tripId)
    .limit(limit)
    .order('day_index', { ascending: true });

  if (error) throw error;
  return data as TripDay[];
}

export function useTripDays(tripId: string, limit: number) {
  return useQuery({
    queryKey: ['trip-days', tripId, limit],
    queryFn: () => getTripDays(tripId, limit),
    enabled: !!tripId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}