import fs from 'fs';
import path from 'path';
import tls from 'tls';
import { fileURLToPath } from 'url';
import { getProfile } from './profile.mjs';
import { updateJobStatus } from './scrapers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APPS_FILE = path.join(__dirname, '..', 'data', 'applications.json');

export function getApplications() {
  try {
    if (fs.existsSync(APPS_FILE)) {
      return JSON.parse(fs.readFileSync(APPS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading applications:', err);
  }
  return [];
}

export function saveApplication(record) {
  try {
    const list = getApplications();
    list.unshift(record);
    fs.writeFileSync(APPS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving application record:', err);
    return false;
  }
}

export function updateApplicationStatus(idOrIds, newStatus, notes) {
  try {
    const list = getApplications();
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    let updatedCount = 0;

    for (const app of list) {
      const match = ids.some(id => 
        id && (id === app.id || (app.company && id.toLowerCase() === app.company.toLowerCase()))
      );
      if (match) {
        app.status = newStatus;
        app.response = newStatus;
        if (notes) {
          app.notes = app.notes ? `${app.notes} • ${notes}` : notes;
        }
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      fs.writeFileSync(APPS_FILE, JSON.stringify(list, null, 2), 'utf-8');
      return { success: true, updatedCount, totalApplications: list.length };
    }
    return { success: false, error: 'No matching applications found' };
  } catch (err) {
    console.error('Error updating application status:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Creates an instant mailto link with encoded subject and body.
 */
export function generateMailtoLink({ to, subject, body }) {
  const encTo = encodeURIComponent(to || '');
  const encSub = encodeURIComponent(subject || '');
  const encBody = encodeURIComponent(body || '');
  return `mailto:${encTo}?subject=${encSub}&body=${encBody}`;
}

/**
 * Sends email via Gmail SMTP using SSL/TLS (port 465).
 * Uses pure Node.js tls module - zero external dependencies required!
 */
export async function sendGmailSmtp({ to, subject, body, userEmail, appPassword }) {
  const profile = getProfile();
  const senderEmail = userEmail || process.env.GMAIL_USER || profile.gmailSettings?.userEmail || profile.email;
  const password = appPassword || process.env.GMAIL_APP_PASSWORD;

  if (!password) {
    return {
      success: false,
      requiresPassword: true,
      error: 'Gmail App Password is not configured. Use the one-click mailto launcher or configure GMAIL_APP_PASSWORD in settings.',
      mailtoUrl: generateMailtoLink({ to, subject, body })
    };
  }

  return new Promise((resolve) => {
    let resolved = false;
    const socket = tls.connect(465, 'smtp.gmail.com', { rejectUnauthorized: true }, () => {
      // Socket connected
    });

    socket.setTimeout(12000, () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({
          success: false,
          error: 'SMTP connection timed out after 12s. Check your network or credentials.',
          mailtoUrl: generateMailtoLink({ to, subject, body })
        });
      }
    });

    let step = 0;
    const b64User = Buffer.from(senderEmail).toString('base64');
    const b64Pass = Buffer.from(password.replace(/\s+/g, '')).toString('base64');

    socket.on('data', (data) => {
      const msg = data.toString();
      const code = parseInt(msg.slice(0, 3), 10);

      if (code >= 400 && code < 600) {
        if (!resolved) {
          resolved = true;
          socket.end();
          resolve({
            success: false,
            error: `SMTP Error (${code}): ${msg.trim()}`,
            mailtoUrl: generateMailtoLink({ to, subject, body })
          });
        }
        return;
      }

      if (step === 0 && code === 220) {
        step++;
        socket.write('EHLO localhost\r\n');
      } else if (step === 1 && code === 250) {
        step++;
        socket.write('AUTH LOGIN\r\n');
      } else if (step === 2 && code === 334) {
        step++;
        socket.write(b64User + '\r\n');
      } else if (step === 3 && code === 334) {
        step++;
        socket.write(b64Pass + '\r\n');
      } else if (step === 4 && code === 235) {
        // Authenticated!
        step++;
        socket.write(`MAIL FROM:<${senderEmail}>\r\n`);
      } else if (step === 5 && code === 250) {
        step++;
        socket.write(`RCPT TO:<${to}>\r\n`);
      } else if (step === 6 && code === 250) {
        step++;
        socket.write('DATA\r\n');
      } else if (step === 7 && code === 354) {
        step++;
        const emailContent = [
          `From: "${profile.name}" <${senderEmail}>`,
          `To: <${to}>`,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=UTF-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          body,
          '.\r\n'
        ].join('\r\n');

        socket.write(emailContent);
      } else if (step === 8 && code === 250) {
        if (!resolved) {
          resolved = true;
          socket.write('QUIT\r\n');
          socket.end();
          resolve({
            success: true,
            message: 'Application successfully delivered via Gmail SMTP!',
            sentAt: new Date().toISOString()
          });
        }
      }
    });

    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        resolve({
          success: false,
          error: `Network error connecting to smtp.gmail.com: ${err.message}`,
          mailtoUrl: generateMailtoLink({ to, subject, body })
        });
      }
    });
  });
}
