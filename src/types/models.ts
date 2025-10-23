export type Trip = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  updated_at: string;
  owner_id: string;
  currency_code?: string;
  activity_count?: number;
};