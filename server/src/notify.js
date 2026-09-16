import db from './db.js';
import { newId, now } from './util.js';

// Notification layer. Every send writes one row to the `notification` table
// (the audit trail of what supervisors were told and when — DATA-MODEL.md),
// then dispatches to the channel adapter. Adapters send for real when their
// env credentials are present, and otherwise log to the console so the app is
// fully functional in dev. Providers are swappable: keep the {send} contract.
//
// Channels (fixed by CLAUDE.md): email = 6pm overdue digest; sms = damage /
// strike / supervised / locked; push = supervisor sign-off needed (in-app).

const TWILIO = {
  sid: process.env.TWILIO_ACCOUNT_SID,
  token: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_FROM,
};
const SMTP = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM || process.env.SMTP_USER,
};

async function sendSms(to, body) {
  if (!TWILIO.sid || !TWILIO.token || !TWILIO.from) {
    console.log(`[sms:log] → ${to}: ${body}`);
    return { delivered: false, via: 'log' };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO.sid}/Messages.json`;
  const form = new URLSearchParams({ To: to, From: TWILIO.from, Body: body });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: 'Basic ' + Buffer.from(`${TWILIO.sid}:${TWILIO.token}`).toString('base64'),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  return { delivered: true, via: 'twilio' };
}

async function sendEmail(to, subject, body) {
  if (!SMTP.host || !SMTP.user || !SMTP.pass) {
    console.log(`[email:log] → ${to} | ${subject}\n${body}`);
    return { delivered: false, via: 'log' };
  }
  // nodemailer is loaded lazily so the server runs without it installed until
  // real SMTP is configured.
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host: SMTP.host,
    port: SMTP.port,
    secure: SMTP.port === 465,
    auth: { user: SMTP.user, pass: SMTP.pass },
  });
  await transport.sendMail({ from: SMTP.from, to, subject, text: body });
  return { delivered: true, via: 'smtp' };
}

function recipientAddress(person, channel) {
  if (channel === 'sms') return person.phone;
  if (channel === 'email') return person.email;
  return null; // push/in-app has no external address
}

// Core entry point. Always records the audit row; delivery failures are logged
// but never throw to the caller (a failed text must not roll back a return).
export async function notify({ type, channel, recipientId, subject, message }) {
  const person = db.prepare('SELECT * FROM person WHERE id = ?').get(recipientId);
  db.prepare(
    'INSERT INTO notification (id, type, channel, recipient, message, at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(newId('notif'), type, channel, recipientId, message, now());

  try {
    const addr = recipientAddress(person, channel);
    if (channel === 'sms') {
      if (!addr) { console.log(`[sms:skip] ${person?.name} has no phone`); return; }
      await sendSms(addr, message);
    } else if (channel === 'email') {
      if (!addr) { console.log(`[email:skip] ${person?.name} has no email`); return; }
      await sendEmail(addr, subject || 'Tool Tracker', message);
    } else {
      console.log(`[push:log] → ${person?.name}: ${message}`);
    }
  } catch (e) {
    console.error(`[notify] delivery failed (${channel} ${type}):`, e.message);
  }
}
