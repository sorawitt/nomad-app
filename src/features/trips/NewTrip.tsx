import type { TargetedEvent } from 'preact'
import { useState } from 'preact/hooks'
import { route } from 'preact-router'
import { useCreateTrip } from './hooks/useCreateTrip'

const FORM_ID = 'new-trip-form'

export default function NewTrip() {
    const createTrip = useCreateTrip()

    const [formData, setFormData] = useState({
        title: '',
        destination: '',
        start_date: '',
        end_date: '',
        currency_code: 'THB',
    })
    const [errors, setErrors] = useState<Record<string, string>>({})

    const validate = () => {
        const newErrors: Record<string, string> = {}

        if (!formData.title.trim()) {
            newErrors.title = 'Trip title is required'
        }

        if (!formData.destination.trim()) {
            newErrors.destination = 'Destination is required'
        }

        if (!formData.start_date) {
            newErrors.start_date = 'Start date is required'
        }

        if (!formData.end_date) {
            newErrors.end_date = 'End date is required'
        }

        if (formData.start_date && formData.end_date) {
            if (new Date(formData.start_date) > new Date(formData.end_date)) {
                newErrors.end_date = 'End date must be after start date'
            }
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const isFormValid = 
        formData.title && 
        formData.destination && 
        formData.start_date && 
        formData.end_date && 
        formData.start_date <= formData.end_date

    const handleSubmit = async (e: TargetedEvent<HTMLFormElement>) => {
        e.preventDefault()
        
        if (!validate()) return

        try {
            const tripId = await createTrip.mutateAsync(formData)
            route(`/trip/${tripId}`, true) // true = replace history
        } catch (error) {
            console.error('Failed to create trip:', error)
        }
    }

    return (
        <div class="min-h-screen bg-gray-50">
            <header class="sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:border-b border-gray-200/60">
                <div class="relative flex items-center justify-center py-4">
                    <button
                        class="absolute left-4 text-blue-600 text-xl hover:text-blue-500"
                        onClick={() => history.back()}
                        type="button"
                        aria-label="Back"
                    >
                        ←
                    </button>
                    <h1 class="text-base font-semibold text-gray-900">New Trip</h1>
                </div>
            </header>

            <main class="px-4 py-6">
                <form id={FORM_ID} class="space-y-6" onSubmit={handleSubmit}>
                    <section>
                        <h2 class="mb-3 text-xs font-semibold tracking-wider text-gray-400">TRIP DETAILS</h2>
                        <div class="space-y-3">
                            <div>
                                <input
                                    type="text"
                                    placeholder="Thailand Explorer"
                                    class={`input-field ${errors.title ? 'border-red-500' : ''}`}
                                    value={formData.title}
                                    onInput={(e) => setFormData({ ...formData, title: (e.target as HTMLInputElement).value })}
                                />
                                {errors.title && (
                                    <p class="mt-1 text-xs text-red-600">{errors.title}</p>
                                )}
                            </div>

                            <div>
                                <input
                                    type="text"
                                    placeholder="Bangkok, Thailand"
                                    class={`input-field ${errors.destination ? 'border-red-500' : ''}`}
                                    value={formData.destination}
                                    onInput={(e) => setFormData({ ...formData, destination: (e.target as HTMLInputElement).value })}
                                />
                                {errors.destination && (
                                    <p class="mt-1 text-xs text-red-600">{errors.destination}</p>
                                )}
                            </div>

                            <div>
                                <input
                                    type="date"
                                    class={`input-field ${errors.start_date ? 'border-red-500' : ''}`}
                                    value={formData.start_date}
                                    max={formData.end_date || undefined}
                                    onInput={(e) => setFormData({ ...formData, start_date: (e.target as HTMLInputElement).value })}
                                />
                                {errors.start_date && (
                                    <p class="mt-1 text-xs text-red-600">{errors.start_date}</p>
                                )}
                            </div>

                            <div>
                                <input
                                    type="date"
                                    class={`input-field ${errors.end_date ? 'border-red-500' : ''}`}
                                    value={formData.end_date}
                                    min={formData.start_date || undefined}
                                    onInput={(e) => setFormData({ ...formData, end_date: (e.target as HTMLInputElement).value })}
                                />
                                {errors.end_date && (
                                    <p class="mt-1 text-xs text-red-600">{errors.end_date}</p>
                                )}
                            </div>
                        </div>
                    </section>

                    {createTrip.error && (
                        <div class="rounded-md bg-red-50 p-3 text-sm text-red-700">
                            {createTrip.error instanceof Error ? createTrip.error.message : 'Failed to create trip'}
                        </div>
                    )}

                    <div class="h-16" />
                </form>
            </main>

            <footer class="fixed inset-x-0 bottom-0 border-t border-gray-200/60 bg-white/90 px-4 py-3 backdrop-blur">
                <button
                    class="btn-primary w-full py-3 text-sm font-medium disabled:opacity-40"
                    form={FORM_ID}
                    type="submit"
                    disabled={!isFormValid || createTrip.isPending}
                >
                    {createTrip.isPending ? 'Creating...' : 'Create Trip'}
                </button>
            </footer>
        </div>
    )
}