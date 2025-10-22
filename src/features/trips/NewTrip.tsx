import type { TargetedEvent } from 'preact'
import { useState } from 'preact/hooks'

const FORM_ID = 'new-trip-form'

const mockCreateTrip = async (data: any) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // 90% success, 10% fail (for demo)
            if (Math.random() > 0.9) {
                resolve({ id: Date.now(), ...data })
            } else {
                reject(new Error('Network error'))
            }
        }, 1000)
    })
}

export default function NewTrip() {
    const [title, setTitle] = useState('')
    const [destination, setDestination] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const isFormValid = title && destination && startDate && endDate && startDate <= endDate

    const handleSubmit = async (e: TargetedEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!isFormValid) return

        setIsLoading(true)
        setError('')
        try {
            const result = await mockCreateTrip({ title, destination, startDate, endDate })
            console.log('Trip created:', result)
            // TODO: navigate to trip details page
            alert(`✓ Trip created! ID: ${result}`)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create trip')
        } finally {
            setIsLoading(false)
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
                            <input
                                type="text"
                                placeholder="Thailand Explorer"
                                class="input-field"
                                value={title}
                                onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
                            />

                            <input
                                type="text"
                                placeholder="Bangkok, Thailand"
                                class="input-field"
                                value={destination}
                                onInput={(e) => setDestination((e.target as HTMLInputElement).value)}
                            />

                            <input
                                type="date"
                                class="input-field"
                                value={startDate}
                                max={endDate || undefined}
                                onInput={(e) => setStartDate((e.target as HTMLInputElement).value)}
                            />

                            <input
                                type="date"
                                class="input-field"
                                value={endDate}
                                min={startDate || undefined}
                                onInput={(e) => setEndDate((e.target as HTMLInputElement).value)}
                            />
                        </div>
                    </section>

                    {error && (
                        <div class="rounded-md bg-red-50 p-3 text-sm text-red-700">
                            {error}
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
                    disabled={!isFormValid || isLoading}
                >
                    {isLoading ? 'Creating...' : 'Create Trip'}
                </button>
            </footer>
        </div>
    )
}