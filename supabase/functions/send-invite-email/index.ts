import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { guestId } = await req.json()

    if (!guestId) {
      return new Response(
        JSON.stringify({ error: 'guestId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
    const fromEmail = Deno.env.get('FROM_EMAIL')!
    const siteUrl = Deno.env.get('SITE_URL')!

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('id, display_name, email, event_id')
      .eq('id', guestId)
      .single()

    if (guestError || !guest) {
      return new Response(
        JSON.stringify({ error: 'Guest not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!guest.email) {
      return new Response(
        JSON.stringify({ error: 'Guest has no email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('title, event_date, location_text')
      .eq('id', guest.event_id)
      .single()

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const invitationUrl = `${siteUrl}/w/${guest.event_id}/${guest.id}`
    const eventDate = new Date(event.event_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })

    const resend = new Resend(resendApiKey)
    const { error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: guest.email,
      subject: `You're invited to ${event.title}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;">
          <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
            <h2 style="margin:0 0 4px;font-size:1.4rem;color:#1e293b;font-weight:800;">You're invited, ${guest.display_name}!</h2>
            <h3 style="margin:0 0 8px;font-size:1.1rem;color:#7c3aed;font-weight:700;">${event.title}</h3>
            <p style="color:#64748b;margin:0 0 4px;font-size:0.9rem;">📅 ${eventDate}</p>
            <p style="color:#64748b;margin:0 0 24px;font-size:0.9rem;">📍 ${event.location_text}</p>
            <a href="${invitationUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.95rem;">View Invitation</a>
            <p style="color:#94a3b8;font-size:0.75rem;margin:24px 0 0;word-break:break-all;">Or copy: ${invitationUrl}</p>
          </div>
        </div>
      `,
      text: `You're invited to ${event.title}\n\n${eventDate}\n${event.location_text}\n\nView your invitation: ${invitationUrl}`,
    })

    if (emailError) {
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
