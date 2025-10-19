import { useMemo, useState, useCallback } from 'preact/hooks'
import { useLocalStorage } from './useLocalStorage'
import type { Trip } from '../types/models'

export function useTripStore() {
  const [trips, setTrips] = useLocalStorage<Trip[]>('trips', [])
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const selectedTrip = useMemo(
    () => trips.find(t => t.id === selectedTripId) ?? null,
    [trips, selectedTripId]
  )

  const filteredTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return trips
    return trips.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.destination.toLowerCase().includes(q)
    )
  }, [trips, searchQuery])

  const stats = useMemo(() => {
    const totalTrips = trips.length
    const totalBudget = trips.reduce((s, t) => s + (t as any).budgetTotal || 0, 0)
    const totalSpent = trips.reduce((s, t) => s + (t as any).spent || 0, 0)
    return { totalTrips, totalBudget, totalSpent }
  }, [trips])

  const addTrip = useCallback((payload: any) => {
    const now = new Date().toISOString()
    const newTrip = {
      ...payload,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      spent: 0,
      activities: [],
      expenses: [],
      checklist: [],
    }
    setTrips(prev => [...prev, newTrip])
    setSelectedTripId(newTrip.id)
    return newTrip
  }, [setTrips])

  const updateTrip = useCallback((id: string, updates: any) => {
    setTrips(prev => prev.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t))
  }, [setTrips])

  const deleteTrip = useCallback((id: string) => {
    setTrips(prev => prev.filter(t => t.id !== id))
    setSelectedTripId(cur => cur === id ? null : cur)
  }, [setTrips])

  return { trips, selectedTrip, selectedTripId, filteredTrips, searchQuery, stats,
           addTrip, updateTrip, deleteTrip, setSelectedTripId, setSearchQuery }
}
