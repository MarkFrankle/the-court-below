import { createClient } from '@supabase/supabase-js'

// The publishable key is public by design; RLS is the security boundary.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
