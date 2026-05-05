import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
  const appUrl = process.env.APP_URL || 'http://localhost:3001'
  const resetUrl = `${appUrl}/auth/reset?token=${token}`

  await transporter.sendMail({
    from: `"HomeApp" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: 'Nulstil din adgangskode',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:16px">
        <div style="font-size:40px;text-align:center;margin-bottom:16px">🏠</div>
        <h1 style="font-size:20px;font-weight:700;text-align:center;margin:0 0 8px">Nulstil adgangskode</h1>
        <p style="color:#94a3b8;text-align:center;margin:0 0 24px">Hej ${name},<br>vi modtog en forespørgsel om at nulstille din adgangskode.</p>
        <a href="${resetUrl}" style="display:block;background:#3b82f6;color:#fff;text-align:center;padding:14px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px">
          Nulstil adgangskode
        </a>
        <p style="color:#475569;font-size:13px;text-align:center;margin:16px 0 0">
          Linket udløber om 1 time.<br>
          Hvis du ikke anmodede om dette, kan du ignorere denne email.
        </p>
      </div>
    `,
  })
}
