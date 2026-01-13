import nodemailer from "nodemailer";

export type OtpEmailType = "sign-up" | "email-verification" | "forget-password" | "sign-in";

export type BillingEmailType = "subscribe" | "renew" | "cancel";

const SUBJECTS: Record<OtpEmailType, string> = {
  "sign-up": "Verify your BotWebAI account",
  "email-verification": "Verify your email address",
  "forget-password": "Reset your BotWebAI password",
  "sign-in": "Your BotWebAI sign-in code",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBillingDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatRupees(amountRupees: number): string {
  return `₹${amountRupees.toLocaleString("en-IN")}`;
}

function buildEmailShell(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f6f7f9; padding:32px;">
  <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
    <h1 style="margin:0 0 8px;font-size:20px;color:#111;">BotWebAI</h1>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function buildOtpHtml(otp: string, type: OtpEmailType): string {
  const intro =
    type === "forget-password"
      ? "Use this code to reset your password:"
      : type === "sign-up"
        ? "Use this code to confirm your signup and create your account:"
        : "Use this verification code:";

  return buildEmailShell(`
    <p style="margin:0 0 24px;color:#52525b;font-size:14px;line-height:1.5;">${intro}</p>
    <div style="letter-spacing:8px;font-size:32px;font-weight:700;color:#111;text-align:center;padding:16px 0;background:#f4f4f5;border-radius:8px;">${otp}</div>
    <p style="margin:24px 0 0;color:#71717a;font-size:12px;line-height:1.5;">This code expires in 10 minutes. If you didn’t request it, you can ignore this email.</p>
  `);
}

function buildBillingHtml(params: {
  greeting: string;
  intro: string;
  details: Array<{ label: string; value: string }>;
  footer: string;
}): string {
  const rows = params.details
    .map(
      (detail) => `
      <tr>
        <td style="padding:8px 0;color:#71717a;font-size:13px;width:40%;">${escapeHtml(detail.label)}</td>
        <td style="padding:8px 0;color:#111;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(detail.value)}</td>
      </tr>`
    )
    .join("");

  return buildEmailShell(`
    <p style="margin:0 0 8px;color:#111;font-size:16px;font-weight:600;">${escapeHtml(params.greeting)}</p>
    <p style="margin:0 0 20px;color:#52525b;font-size:14px;line-height:1.5;">${escapeHtml(params.intro)}</p>
    <div style="background:#f4f4f5;border-radius:8px;padding:8px 16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p style="margin:20px 0 0;color:#71717a;font-size:12px;line-height:1.5;">${escapeHtml(params.footer)}</p>
  `);
}

function hasSmtpConfig(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function createTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });
}

async function sendMail(params: {
  email: string;
  subject: string;
  text: string;
  html: string;
  logLabel: string;
  replyTo?: string;
}): Promise<void> {
  const { email, subject, text, html, logLabel, replyTo } = params;

  if (!hasSmtpConfig()) {
    console.info(`[${logLabel}] SMTP not configured — would send to ${email}: ${subject}`);
    return;
  }

  const transport = createTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    replyTo,
    subject,
    text,
    html,
  });
}

export async function sendOtpEmail(params: {
  email: string;
  otp: string;
  type: OtpEmailType;
}): Promise<void> {
  const { email, otp, type } = params;
  const subject = SUBJECTS[type];
  const html = buildOtpHtml(otp, type);
  const text = `${subject}\n\nYour code is: ${otp}\n\nThis code expires in 10 minutes.`;

  await sendMail({
    email,
    subject,
    text,
    html,
    logLabel: "otp-email",
  });
}

export async function sendBillingEmail(params: {
  email: string;
  name?: string | null;
  type: BillingEmailType;
  planName: string;
  amountRupees: number;
  periodEnd: Date | string;
}): Promise<void> {
  const { email, type, planName, amountRupees, periodEnd } = params;
  const name = params.name?.trim() || "there";
  const periodEndLabel = formatBillingDate(periodEnd);
  const priceLabel = formatRupees(amountRupees);

  let subject: string;
  let intro: string;
  let footer: string;
  let details: Array<{ label: string; value: string }>;

  if (type === "subscribe") {
    subject = `You're subscribed to BotWebAI ${planName}`;
    intro = `Thanks for subscribing. Your ${planName} plan is now active.`;
    details = [
      { label: "Plan", value: planName },
      { label: "Amount", value: `${priceLabel}/month` },
      { label: "Renews on", value: periodEndLabel },
    ];
    footer =
      "You can manage or cancel your subscription anytime from Billing in your dashboard.";
  } else if (type === "renew") {
    subject = `Your BotWebAI ${planName} plan was renewed`;
    intro = `Your ${planName} plan payment went through and your billing period has been extended.`;
    details = [
      { label: "Plan", value: planName },
      { label: "Amount", value: `${priceLabel}/month` },
      { label: "New renewal date", value: periodEndLabel },
    ];
    footer =
      "You can manage or cancel your subscription anytime from Billing in your dashboard.";
  } else {
    subject = `Your BotWebAI ${planName} plan has been cancelled`;
    intro = `Your ${planName} plan is cancelled. You’ll keep paid access until the end of the current billing period, then move to Free.`;
    details = [
      { label: "Plan", value: planName },
      { label: "Access until", value: periodEndLabel },
      { label: "After that", value: "Free plan" },
    ];
    footer =
      "Changed your mind? You can subscribe again anytime from Billing in your dashboard.";
  }

  const html = buildBillingHtml({
    greeting: `Hi ${name},`,
    intro,
    details,
    footer,
  });

  const text = [
    subject,
    "",
    `Hi ${name},`,
    intro,
    "",
    ...details.map((detail) => `${detail.label}: ${detail.value}`),
    "",
    footer,
  ].join("\n");

  await sendMail({
    email,
    subject,
    text,
    html,
    logLabel: `billing-email:${type}`,
  });
}

export async function sendContactEmail(params: {
  name: string;
  email: string;
  subject: string;
  message: string;
  to: string;
}): Promise<void> {
  const name = params.name.trim();
  const email = params.email.trim();
  const subject = params.subject.trim();
  const message = params.message.trim();
  const mailSubject = `[Contact] ${subject}`;

  const html = buildEmailShell(`
    <p style="margin:0 0 8px;color:#111;font-size:16px;font-weight:600;">New contact message</p>
    <p style="margin:0 0 20px;color:#52525b;font-size:14px;line-height:1.5;">Someone submitted the contact form on BotWebAI.</p>
    <div style="background:#f4f4f5;border-radius:8px;padding:8px 16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          <tr>
            <td style="padding:8px 0;color:#71717a;font-size:13px;width:40%;">Name</td>
            <td style="padding:8px 0;color:#111;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(name)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#71717a;font-size:13px;width:40%;">Email</td>
            <td style="padding:8px 0;color:#111;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(email)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#71717a;font-size:13px;width:40%;">Subject</td>
            <td style="padding:8px 0;color:#111;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(subject)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p style="margin:20px 0 8px;color:#71717a;font-size:12px;line-height:1.5;">Message</p>
    <p style="margin:0;color:#111;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</p>
  `);

  const text = [
    "New contact message",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Subject: ${subject}`,
    "",
    message,
  ].join("\n");

  await sendMail({
    email: params.to,
    subject: mailSubject,
    text,
    html,
    replyTo: email,
    logLabel: "contact-email",
  });
}
