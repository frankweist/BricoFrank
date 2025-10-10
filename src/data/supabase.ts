﻿// tolerante a falta de .env
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

function isValidHttp(u?: string) {
  try { if (!u) return false; const x = new URL(u); return x.protocol === "http:" || x.protocol === "https:" }
  catch { return false }
}

export const supa: SupabaseClient | null = (isValidHttp(url) && key)
  ? createClient(url!, key!)
  : null
