import nodemailer from 'nodemailer'

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

const hasSmtpConfig = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export const sendEmail = async ({ to, subject, html, text }) => {
  const senderName = process.env.BREVO_FROM_NAME || 'Marketivo'
  const senderEmail = process.env.BREVO_FROM

  if (!senderEmail) {
    throw new Error('BREVO_FROM is required for email delivery')
  }

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text,
  }

  try {
    if (!process.env.BREVO_API_KEY) {
      throw new Error('Missing BREVO_API_KEY')
    }
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Brevo API error: ${response.status} ${errorText}`)
    }
  } catch (error) {
    if (!hasSmtpConfig()) {
      throw error
    }
    const transporter = createTransporter()
    await transporter.sendMail({
      from: `${senderName} <${senderEmail}>`,
      to,
      subject,
      html,
      text,
    })
  }
}

export const buildOtpEmail = ({ otp, purpose }) => {
  const subject = `Your ${purpose} OTP Code`
  const text = `Your Marketivo verification code is ${otp}. It expires in 5 minutes.`
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin: 0 0 12px; color: #1f2937;">Marketivo Verification</h2>
      <p style="margin: 0 0 16px;">Use the OTP below to complete your ${purpose.toLowerCase()}:</p>
      <div style="display: inline-block; padding: 12px 18px; background: #2563eb; color: #ffffff; border-radius: 8px; font-size: 20px; font-weight: 700; letter-spacing: 4px;">
        ${otp}
      </div>
      <p style="margin: 16px 0 0;">This code expires in 5 minutes.</p>
      <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">If you did not request this, you can ignore this email.</p>
    </div>
  `
  return { subject, text, html }
}
