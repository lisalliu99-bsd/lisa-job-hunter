import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProfile, updateProfile } from './lib/profile.mjs';
import { getJobs, updateJobStatus, runMultiSourceScrape } from './lib/scrapers.mjs';
import { generateCoverLetter } from './lib/cover-letter.mjs';
import { getCvSuggestions } from './lib/cv-optimizer.mjs';
import { sendGmailSmtp, generateMailtoLink, getApplications, saveApplication, updateApplicationStatus } from './lib/gmail.mjs';
import { getSchedulerStatus, startScheduler, executeScheduledHunt } from './lib/scheduler.mjs';
import { getFranceTravailApiConfig } from './lib/francetravail-api.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

// Start 4x/day background timer
startScheduler();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // --- REST API ENDPOINTS ---

  // GET /api/health
  if (method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { status: 'healthy', timestamp: new Date().toISOString() });
  }

  // GET /api/profile
  if (method === 'GET' && pathname === '/api/profile') {
    return sendJson(res, 200, getProfile());
  }

  // POST /api/profile
  if (method === 'POST' && pathname === '/api/profile') {
    try {
      const body = await parseJsonBody(req);
      const result = updateProfile(body);
      return sendJson(res, result.success ? 200 : 500, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // GET /api/jobs (Supports timeline-first recent sort, score sort, and filters)
  if (method === 'GET' && pathname === '/api/jobs') {
    const source = parsedUrl.searchParams.get('source') || 'all';
    const contract = parsedUrl.searchParams.get('contract') || 'all';
    const minScore = parsedUrl.searchParams.get('minScore');
    const status = parsedUrl.searchParams.get('status') || 'all';
    const query = parsedUrl.searchParams.get('query') || '';
    const hideApplied = parsedUrl.searchParams.get('hideApplied');
    const sortBy = parsedUrl.searchParams.get('sortBy') || 'recent';
    const jobs = getJobs({ source, contract, minScore, status, query, hideApplied, sortBy });
    return sendJson(res, 200, { total: jobs.length, jobs });
  }

  // GET /api/francetravail/status
  if (method === 'GET' && pathname === '/api/francetravail/status') {
    const status = getFranceTravailApiConfig();
    return sendJson(res, 200, status);
  }

  // POST /api/jobs/scrape (Trigger 5-site scan)
  if (method === 'POST' && pathname === '/api/jobs/scrape') {
    try {
      const result = await executeScheduledHunt('manual-dashboard');
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // POST /api/jobs/action (Save / Dismiss / Applied)
  if (method === 'POST' && pathname === '/api/jobs/action') {
    try {
      const body = await parseJsonBody(req);
      const { jobId, status } = body;
      if (!jobId || !status) return sendJson(res, 400, { error: 'Missing jobId or status' });
      const result = updateJobStatus(jobId, status);
      return sendJson(res, result.success ? 200 : 404, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // POST /api/cover-letter/generate
  if (method === 'POST' && pathname === '/api/cover-letter/generate') {
    try {
      const body = await parseJsonBody(req);
      const { job, tone, language } = body;
      if (!job) return sendJson(res, 400, { error: 'Missing job details' });
      const letter = generateCoverLetter({ job, tone, language });
      return sendJson(res, 200, { letter });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // POST /api/cv-suggestions
  if (method === 'POST' && pathname === '/api/cv-suggestions') {
    try {
      const body = await parseJsonBody(req);
      const { job } = body;
      if (!job) return sendJson(res, 400, { error: 'Missing job details' });
      const analysis = getCvSuggestions(job);
      return sendJson(res, 200, analysis);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // POST /api/gmail/send
  if (method === 'POST' && pathname === '/api/gmail/send') {
    try {
      const body = await parseJsonBody(req);
      const { jobId, to, subject, letterBody, useAppPassword } = body;
      const profile = getProfile();

      if (!to || !subject || !letterBody) {
        return sendJson(res, 400, { error: 'Missing required email fields (to, subject, letterBody)' });
      }

      // Always prepare the instant mailto fallback
      const mailtoUrl = generateMailtoLink({ to, subject, body: letterBody });

      if (useAppPassword) {
        const smtpResult = await sendGmailSmtp({
          to,
          subject,
          body: letterBody,
          userEmail: profile.gmailSettings?.userEmail,
          appPassword: process.env.GMAIL_APP_PASSWORD
        });

        if (smtpResult.success) {
          // Record application
          saveApplication({
            id: `app-${Date.now()}`,
            jobId,
            jobTitle: subject,
            company: to.split('@')[1] || 'Company',
            recipientEmail: to,
            candidateName: profile.name,
            appliedAt: new Date().toISOString(),
            method: 'Gmail SMTP',
            status: 'Delivered',
            coverLetterSnippet: letterBody.slice(0, 160) + '...'
          });

          if (jobId) updateJobStatus(jobId, 'applied');
          return sendJson(res, 200, smtpResult);
        } else {
          return sendJson(res, 200, {
            success: false,
            fallbackRequired: true,
            message: smtpResult.error,
            mailtoUrl
          });
        }
      } else {
        // Mailto Mode
        saveApplication({
          id: `app-${Date.now()}`,
          jobId,
          jobTitle: subject,
          company: to.split('@')[1] || 'Company',
          recipientEmail: to,
          candidateName: profile.name,
          appliedAt: new Date().toISOString(),
          method: 'Gmail Client (mailto)',
          status: 'Prepared',
          coverLetterSnippet: letterBody.slice(0, 160) + '...'
        });

        if (jobId) updateJobStatus(jobId, 'applied');
        return sendJson(res, 200, {
          success: true,
          mode: 'mailto',
          mailtoUrl
        });
      }
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // GET /api/applications
  if (method === 'GET' && pathname === '/api/applications') {
    return sendJson(res, 200, { applications: getApplications() });
  }

  // POST /api/applications/record (Mark job as applied manually or from feed)
  if (method === 'POST' && pathname === '/api/applications/record') {
    try {
      const body = await parseJsonBody(req);
      const { jobId, company, jobTitle, dateApplied, notes, status, portalUrl } = body;
      if (!company || !jobTitle) {
        return sendJson(res, 400, { error: 'Missing company or jobTitle' });
      }

      const newRecord = {
        id: `app-${Date.now()}`,
        company: company.trim(),
        jobTitle: jobTitle.trim(),
        dateApplied: dateApplied || new Date().toISOString().split('T')[0],
        timeline: '',
        response: status || 'Pending',
        status: status || 'Pending',
        notes: notes || 'Marked as applied from dashboard',
        portalUrl: portalUrl || ''
      };

      saveApplication(newRecord);
      if (jobId) {
        updateJobStatus(jobId, 'applied');
      }

      return sendJson(res, 200, {
        success: true,
        message: `Marked application to ${company} as applied!`,
        record: newRecord,
        totalApplications: getApplications().length
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // POST /api/applications/update-status (Update status of one or more applications)
  if (method === 'POST' && pathname === '/api/applications/update-status') {
    try {
      const body = await parseJsonBody(req);
      const { id, ids, status, notes } = body;
      const targetIds = ids || (id ? [id] : []);
      if (targetIds.length === 0 || !status) {
        return sendJson(res, 400, { error: 'Missing id(s) or status' });
      }

      const result = updateApplicationStatus(targetIds, status, notes);
      return sendJson(res, result.success ? 200 : 404, result);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // POST /api/jobs/reject (Mark a job card directly as rejected and move into rejected pile)
  if (method === 'POST' && pathname === '/api/jobs/reject') {
    try {
      const body = await parseJsonBody(req);
      const { jobId, company, jobTitle, reason } = body;
      if (!company) {
        return sendJson(res, 400, { error: 'Missing company name' });
      }

      // Update job status if in jobs catalog
      if (jobId) {
        updateJobStatus(jobId, 'rejected');
      }

      // Check if already in applications.json
      const existingApps = getApplications();
      const existing = existingApps.find(a => 
        (a.company && a.company.toLowerCase() === company.toLowerCase()) ||
        (jobId && a.id === jobId)
      );

      if (existing) {
        updateApplicationStatus(existing.id, 'Rejected', reason || 'Marked as rejected from job feed');
      } else {
        const newRecord = {
          id: `app-rej-${Date.now()}`,
          company: company.trim(),
          jobTitle: jobTitle ? jobTitle.trim() : 'Alternance',
          dateApplied: new Date().toISOString().split('T')[0],
          timeline: '',
          response: 'Rejected',
          status: 'Rejected',
          notes: reason ? `Rejected: ${reason}` : 'Marked as rejected from search feed',
          portalUrl: ''
        };
        saveApplication(newRecord);
      }

      return sendJson(res, 200, {
        success: true,
        message: `Role at ${company} moved into the rejected pile.`,
        totalApplications: getApplications().length
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // GET /api/cron/status
  if (method === 'GET' && pathname === '/api/cron/status') {
    return sendJson(res, 200, getSchedulerStatus());
  }

  // --- STATIC ASSET SERVING ---
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      // Fallback to index.html for SPA routing
      const indexHtml = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(indexHtml).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` ✨ Job Hunter Agent for Lisa Liu`);
  console.log(` 🌐 Dashboard Live at: http://localhost:${PORT}`);
  console.log(` ⏰ 2x Daily Scheduler: Active (09:00, 17:00)`);
  console.log(`======================================================\n`);
});
