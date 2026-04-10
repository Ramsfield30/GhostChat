const SUPABASE_URL = 'https://hbgzswvvurwacldackbg.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiZ3pzd3Z2dXJ3YWNsZGFja2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTg1NjUsImV4cCI6MjA5MDEzNDU2NX0.CHBeHmplFCtf4ocwj4rgTv2nhg_DdvaFn4qwVL5D6LA'
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

async function hashPassword(password) {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}