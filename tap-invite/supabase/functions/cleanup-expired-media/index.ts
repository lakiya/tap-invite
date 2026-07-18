import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, event_date, is_premium')
    if (eventsError) throw eventsError

    const now = Date.now()
    const expiredEventIds = (events ?? [])
      .filter((e: { event_date: string; is_premium: boolean }) => {
        const retentionDays = e.is_premium ? 14 : 1
        const expiry = new Date(e.event_date)
        expiry.setDate(expiry.getDate() + retentionDays)
        return now > expiry.getTime()
      })
      .map((e: { id: string }) => e.id)

    if (expiredEventIds.length === 0) {
      return new Response(JSON.stringify({ deleted: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const { data: expiredMedia, error: mediaError } = await supabase
      .from('event_media')
      .select('id, storage_path')
      .in('event_id', expiredEventIds)
    if (mediaError) throw mediaError

    if (!expiredMedia || expiredMedia.length === 0) {
      return new Response(JSON.stringify({ deleted: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const paths = expiredMedia.map((m: { storage_path: string }) => m.storage_path)
    const { error: storageError } = await supabase.storage.from('event-media').remove(paths)
    if (storageError) console.error('Storage cleanup error:', storageError)

    const ids = expiredMedia.map((m: { id: string }) => m.id)
    const { error: deleteError } = await supabase.from('event_media').delete().in('id', ids)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ deleted: ids.length }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('Unexpected error in cleanup-expired-media:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
