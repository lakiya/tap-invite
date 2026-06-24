import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string).replace('v1,whsec_', '')

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 405 })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  const wh = new Webhook(hookSecret)

  try {
    const { user, email_data } = wh.verify(payload, headers) as {
      user: { email: string }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
        site_url: string
        token_new: string
        token_hash_new: string
      }
    }

    const { email_action_type, token_hash, redirect_to, site_url } = email_data
    const magicLinkUrl = `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`

    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'TapInvite <noreply@tapinvite.app>'

    if (email_action_type === 'magiclink' || email_action_type === 'signup') {
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: [user.email],
        subject: 'Your TapInvite sign-in link',
        html: magicLinkEmailHtml(magicLinkUrl),
      })
      if (error) throw error
    }
  } catch (error) {
    console.error('send-auth-email error:', error)
    return Response.json(
      { error: { http_code: error.statusCode ?? 500, message: error.message } },
      { status: 401 }
    )
  }

  return Response.json({})
})

function magicLinkEmailHtml(url: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;box-shadow:0 8px 40px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="padding:40px 36px 0;">
              <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;font-size:20px;font-weight:800;line-height:48px;text-align:center;">T</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 36px 0;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">Sign in to TapInvite</h1>
              <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6;">Click the button below to sign in. This link is valid for 48 hours and can only be used once.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 36px;">
              <a href="${url}" style="display:inline-block;padding:14px 36px;border-radius:12px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 4px 14px rgba(249,115,22,0.35);">Sign In</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 36px;">
              <hr style="border:none;border-top:1px solid #f1f5f9;margin:0 0 20px;">
              <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-align:center;">If you didn't request this link, you can safely ignore this email.</p>
              <p style="margin:0;font-size:11px;color:#cbd5e1;text-align:center;word-break:break-all;">
                <a href="${url}" style="color:#cbd5e1;">${url}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
