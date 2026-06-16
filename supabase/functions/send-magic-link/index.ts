import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, redirectTo } = await req.json()

    if (!email || !redirectTo) {
      return new Response(
        JSON.stringify({ error: 'email and redirectTo are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const gmailUser = Deno.env.get('GMAIL_USER')!
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD')!

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo }
    })

    if (linkError || !data?.properties?.action_link) {
      return new Response(
        JSON.stringify({ error: linkError?.message ?? 'Failed to generate magic link' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const magicLink = data.properties.action_link

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPassword },
    })

    try {
      await transporter.sendMail({
        from: `TapInvite <${gmailUser}>`,
        to: email,
        subject: 'Your TapInvite sign-in link',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;">
            <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
              <h2 style="margin:0 0 8px;font-size:1.4rem;color:#1e293b;font-weight:800;">Sign in to TapInvite</h2>
              <p style="color:#64748b;margin:0 0 24px;font-size:0.9rem;">Click the button below to sign in. This link expires in 24 hours and can only be used once.</p>
              <a href="${magicLink}" style="display:inline-block;background:#7c3aed;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.95rem;">Sign In to TapInvite</a>
              <p style="color:#94a3b8;font-size:0.75rem;margin:24px 0 0;word-break:break-all;">Or copy this URL: ${magicLink}</p>
            </div>
          </div>
        `,
        text: `Sign in to TapInvite:\n\n${magicLink}\n\nThis link expires in 24 hours.`,
      })
    } catch {
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
