import { createClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

// ✅ Crea el cliente con las variables de entorno (funciona en local y en GitHub Pages)
export const supa = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
)
