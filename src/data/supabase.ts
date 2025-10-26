import { createClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

// --- Modo híbrido: usa variables de entorno si existen, o valores fijos en producción ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dzazapfzfuonyuvslhgk.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6YXphcGZ6ZnVvbnl1dnNsaGdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNDA3NzAsImV4cCI6MjA3NTYxNjc3MH0.wSVO93VzKwC3Tvwwh-1yCDb1gV0Kw5ava5iBGYfD_j0'

// --- Crear cliente ---
export const supa = createClient<Database>(supabaseUrl, supabaseAnonKey)

// --- Exponer en ventana global para depuración ---
;(window as any).supa = supa

// --- Indicador visual de conexión Supabase ---
;(async () => {
  try {
    const { data, error } = await supa.from('backups').select('id').limit(1)
    const ok = data && !error
    const el = document.createElement('div')
    el.textContent = ok ? '🟢 Conectado a Supabase' : '🔴 Error de conexión con Supabase'
    el.style.position = 'fixed'
    el.style.bottom = '8px'
    el.style.left = '8px'
    el.style.padding = '6px 10px'
    el.style.fontSize = '12px'
    el.style.borderRadius = '6px'
    el.style.background = ok ? '#064e3b' : '#7f1d1d'
    el.style.color = 'white'
    el.style.zIndex = '9999'
    document.body.appendChild(el)
  } catch (e) {
    const el = document.createElement('div')
    el.textContent = '🔴 Error de conexión con Supabase'
    el.style.position = 'fixed'
    el.style.bottom = '8px'
    el.style.left = '8px'
    el.style.padding = '6px 10px'
    el.style.fontSize = '12px'
    el.style.borderRadius = '6px'
    el.style.background = '#7f1d1d'
    el.style.color = 'white'
    el.style.zIndex = '9999'
    document.body.appendChild(el)
  }
})()

