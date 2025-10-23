import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';

export type TripDay = {
  id: string;
  title: string;
  trip_id: string;
  day_index: number;
  date: string;
  activity_count: number;
  expense_total: number;
};

const getTripDays = async (tripId: string, limit: number) => {
  const { data, error } = await supabase
    .from('trip_days')
    .select(`
      id,
      title,
      trip_id,
      day_index,
      date,
      activities(count),
      expenses(amount)
    `)
    .eq('trip_id', tripId)
    .limit(limit)
    .order('day_index', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((day: any) => {
    const activityCount = day.activities?.[0]?.count ?? 0;
    const expenseTotal = Array.isArray(day.expenses)
      ? day.expenses.reduce(
          (total: number, expense: { amount?: number | string } | null) =>
            total + Number(expense?.amount ?? 0),
          0
        )
      : 0;

    return {
      id: day.id,
      title: day.title,
      trip_id: day.trip_id,
      day_index: day.day_index,
      date: day.date,
      activity_count: activityCount,
      expense_total: expenseTotal,
    } as TripDay;
  });
}

export function useTripDays(tripId: string, limit: number) {
  return useQuery({
    queryKey: ['trip-days', tripId, limit],
    queryFn: () => getTripDays(tripId, limit),
    enabled: !!tripId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
