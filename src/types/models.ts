export interface Trip {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  budget: number
  spent: number
  activities: Activity[]
}

export interface Activity {
  id: string
  title: string
  date: string
  cost: number
  completed: boolean
}