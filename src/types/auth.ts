import type { Session, User } from "@supabase/supabase-js"

export type AuthContextValue = {
    user: User | null
    session: Session | null
    loading: boolean
    signInWithGoogle: () => Promise<void>
    signOut: () => Promise<void>
}