import type { Activity } from '../types/models'

export const mockActivities: Activity[] = [
  {
    id: 'act-001',
    title: 'Visit Fushimi Inari Shrine',
    date: '2025-11-03',
    cost: 500,
    completed: true,
  },
  {
    id: 'act-002',
    title: 'Try Kyoto Kaiseki Dinner',
    date: '2025-11-04',
    cost: 3500,
    completed: false,
  },
  {
    id: 'act-003',
    title: 'Arashiyama Bamboo Grove Walk',
    date: '2025-11-05',
    cost: 0,
    completed: false,
  },
  {
    id: 'act-004',
    title: 'Elephant Sanctuary Visit',
    date: '2025-12-19',
    cost: 1200,
    completed: true,
  },
  {
    id: 'act-005',
    title: 'Doi Inthanon Trekking',
    date: '2025-12-21',
    cost: 1800,
    completed: false,
  },
  {
    id: 'act-006',
    title: 'Gardens by the Bay',
    date: '2026-01-10',
    cost: 800,
    completed: true,
  },
  {
    id: 'act-007',
    title: 'Marina Bay Sands SkyPark',
    date: '2026-01-11',
    cost: 1000,
    completed: false,
  },
]
