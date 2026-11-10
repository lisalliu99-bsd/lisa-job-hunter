// State Management for Lisa Liu's Job Hunter Agent
let allJobs = [];
let allApplications = [];
let hidePreviouslyApplied = true; // Anti-overlap active by default
let currentFilterSource = 'all';
let currentFilterContract = 'all'; // Support Alternance, CDI, and CDD filters
let currentMinScore = 5.0; // Expanded to 5.0+ as requested
let currentSortBy = 'recent'; // Prioritize timeline by default (most recently posted first)
let searchQuery = '';
let currentJobForModal = null;
let currentTone = 'modern';
let currentLang = 'en'; // Default to English for international teams
let currentProfile = null;
let currentAppStatusFilter = 'all';
let appSearchQuery = '';
let selectedAppIds = new Set(); // Multi-select for rejected pile

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  setupNavigation();
  setupFilters();
  setupBatchActions();
  setupModals();
  await loadProfile();
  await loadJobs();
  await loadApplications();
  await updateSchedulerStatus();

  // Poll scheduler countdown every 30s
  setInterval(updateSchedulerStatus, 30000);
});

// Toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `p-3.5 rounded-2xl text-xs font-semibold shadow-2xl backdrop-blur-xl border transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto flex items-center gap-2 ${
    type === 'success' 
      ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200' 
      : type === 'error'
      ? 'bg-red-950/80 border-red-500/40 text-red-200'
      : 'bg-indigo-950/80 border-indigo-500/40 text-indigo-200'
  }`;
  
  toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// Navigation Tabs
function setupNavigation() {
  const tabFeed = document.getElementById('btn-tab-feed');
  const tabApps = document.getElementById('btn-tab-apps');
  const tabProfile = document.getElementById('btn-tab-profile');
  const viewFeed = document.getElementById('view-feed');
  const viewApps = document.getElementById('view-apps');
  const viewProfile = document.getElementById('view-profile');

  function setActiveTab(btn, activeView) {
    [tabFeed, tabApps, tabProfile].forEach(b => {
      b.className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/60 text-slate-300 border border-white/5 hover:bg-slate-800 transition flex items-center gap-1.5';
    });
    btn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/50 transition flex items-center gap-1.5';

    [viewFeed, viewApps, viewProfile].forEach(v => v.classList.add('hidden'));
    activeView.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  tabFeed.addEventListener('click', () => setActiveTab(tabFeed, viewFeed));
  tabApps.addEventListener('click', () => {
    setActiveTab(tabApps, viewApps);
    loadApplications();
  });
  tabProfile.addEventListener('click', () => setActiveTab(tabProfile, viewProfile));

  // Trigger Scan Button
  const btnScan = document.getElementById('btn-trigger-scan');
  const scanIcon = document.getElementById('scan-icon');
  btnScan.addEventListener('click', async () => {
    btnScan.disabled = true;
    scanIcon.classList.add('animate-spin');
    showToast('Scanning 8 sites: WTTJ, APEC, LinkedIn, Indeed, France Travail, HelloWork, JobTeaser & Station F...', 'info');

    try {
      const res = await fetch('/api/jobs/scrape', { method: 'POST' });
      const data = await res.json();
      showToast(`Scan complete! Discovered ${data.newJobs || 0} matching contracts & roles.`, 'success');
      await loadJobs();
      await updateSchedulerStatus();
    } catch (err) {
      showToast('Error executing scan: ' + err.message, 'error');
    } finally {
      btnScan.disabled = false;
      scanIcon.classList.remove('animate-spin');
    }
  });
}

// Filter controls
function setupFilters() {
  // Anti-Overlap Toggle
  const btnToggleOverlap = document.getElementById('btn-toggle-overlap');
  const overlapLabel = document.getElementById('overlap-toggle-label');
  if (btnToggleOverlap) {
    btnToggleOverlap.addEventListener('click', () => {
      hidePreviouslyApplied = !hidePreviouslyApplied;
      if (hidePreviouslyApplied) {
        btnToggleOverlap.className = 'w-full sm:w-auto px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm';
        overlapLabel.textContent = `Hide Applied (${allApplications.length})`;
        showToast(`Filtered out ${allApplications.length} previously applied companies!`, 'info');
      } else {
        btnToggleOverlap.className = 'w-full sm:w-auto px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm';
        overlapLabel.textContent = `Showing All (with ${allApplications.length} Applied)`;
        showToast('Showing all jobs including previously applied companies.', 'info');
      }
      renderJobs();
    });
  }

  const sourceButtons = document.querySelectorAll('.filter-source-btn');
  sourceButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sourceButtons.forEach(b => {
        b.className = 'filter-source-btn px-3 py-1 rounded-lg text-xs font-medium bg-slate-800/80 text-slate-300 hover:bg-slate-700';
      });
      btn.className = 'filter-source-btn px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white';
      currentFilterSource = btn.dataset.source;
      renderJobs();
    });
  });

  const contractButtons = document.querySelectorAll('.filter-contract-btn');
  contractButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      contractButtons.forEach(b => {
        b.className = 'filter-contract-btn px-3 py-1 rounded-lg text-xs font-medium bg-slate-800/80 text-slate-300 hover:bg-slate-700 flex items-center gap-1';
      });
      btn.className = 'filter-contract-btn px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white flex items-center gap-1';
      currentFilterContract = btn.dataset.contract;
      renderJobs();
    });
  });

  // Order By / Sorting Selector (Timeline First, Score, Start Date)
  const sortButtons = document.querySelectorAll('.filter-sort-btn');
  sortButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sortButtons.forEach(b => {
        b.className = 'filter-sort-btn px-3 py-1 rounded-lg text-xs font-medium bg-slate-800/80 text-slate-300 hover:bg-slate-700 flex items-center gap-1 transition';
      });
      btn.className = 'filter-sort-btn px-3 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-cyan-500/25 to-indigo-500/25 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 shadow-sm transition';
      currentSortBy = btn.dataset.sort;
      showToast(`Ordering by ${btn.textContent.trim()}!`, 'info');
      renderJobs();
    });
  });

  const scoreSlider = document.getElementById('filter-score-slider');
  const scoreVal = document.getElementById('filter-score-val');
  scoreSlider.addEventListener('input', (e) => {
    currentMinScore = parseFloat(e.target.value);
    scoreVal.textContent = currentMinScore.toFixed(1) + '+';
    renderJobs();
  });

  const searchInput = document.getElementById('filter-search-input');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderJobs();
  });

  // Application Tracker Filters
  const appFilterBtns = document.querySelectorAll('.app-status-filter-btn');
  appFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      appFilterBtns.forEach(b => b.className = 'app-status-filter-btn px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700');
      btn.className = 'app-status-filter-btn px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white';
      currentAppStatusFilter = btn.dataset.appFilter;
      renderApplicationsTable();
    });
  });

  const appSearch = document.getElementById('app-search-input');
  if (appSearch) {
    appSearch.addEventListener('input', (e) => {
      appSearchQuery = e.target.value.toLowerCase().trim();
      renderApplicationsTable();
    });
  }
}

// Load jobs from API (passes timeline sort by default)
async function loadJobs() {
  try {
    const res = await fetch(`/api/jobs?sortBy=${currentSortBy}`);
    const data = await res.json();
    allJobs = data.jobs || [];
    renderJobs();
    updateKpis();
  } catch (err) {
    console.error('Failed to load jobs:', err);
  }
}

// Update KPI stats
function updateKpis() {
  document.getElementById('stat-total-jobs').textContent = allJobs.length;
  const highMatches = allJobs.filter(j => (j.grade?.overall || 0) >= 9.0).length;
  document.getElementById('stat-high-matches').textContent = highMatches;

  // Early timeline window counter (<= 48 hours)
  const earlyWindowCount = allJobs.filter(j => {
    if (!j.postedAt) return false;
    const diffHours = (Date.now() - new Date(j.postedAt).getTime()) / (1000 * 60 * 60);
    return diffHours <= 48;
  }).length;
  const earlyEl = document.getElementById('stat-early-window');
  if (earlyEl) earlyEl.textContent = earlyWindowCount;

  const countAlt = document.getElementById('contract-count-alt');
  if (countAlt) countAlt.textContent = allJobs.filter(j => /alternance|apprentissage/i.test(j.contract || '')).length;

  const countCdi = document.getElementById('contract-count-cdi');
  if (countCdi) countCdi.textContent = allJobs.filter(j => /cdi|permanent/i.test(j.contract || '')).length;

  const countCdd = document.getElementById('contract-count-cdd');
  if (countCdd) countCdd.textContent = allJobs.filter(j => /cdd|fixed-term/i.test(j.contract || '')).length;
}

// Time formatting helper for job posting dates
function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Recently';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now (<1h)';
  if (diffHours < 24) return `${diffHours}h ago (Today)`;
  if (diffDays === 1) return '1d ago (Yesterday)';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 14) return '1w ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

// Early application window badge helper
function getEarlyWindowBadge(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const diffHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours <= 24) {
    return `
      <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm shadow-emerald-500/20">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        ⚡ Early Window (<24h)
      </span>
    `;
  }
  if (diffHours <= 48) {
    return `
      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
        <i data-lucide="zap" class="w-3 h-3 text-cyan-400"></i> Early Window (<48h)
      </span>
    `;
  }
  return '';
}

// Render job cards list
function renderJobs() {
  const container = document.getElementById('jobs-container');

  const filtered = allJobs.filter(job => {
    const isRejected = job.status === 'rejected' || (job.appliedHistory?.status || '').toLowerCase().includes('reject');
    // Anti-overlap filter: hides applied and rejected roles when anti-overlap is active
    if (hidePreviouslyApplied && (job.appliedHistory?.previouslyApplied || job.status === 'applied' || isRejected)) {
      return false;
    }

    if (currentFilterSource !== 'all' && job.source.toLowerCase() !== currentFilterSource.toLowerCase()) {
      return false;
    }
    if (currentFilterContract !== 'all') {
      const c = (job.contract || '').toLowerCase();
      const f = currentFilterContract.toLowerCase();
      if (f === 'alternance' && !/alternance|apprentissage/i.test(c)) return false;
      if (f === 'cdi' && !/cdi|permanent/i.test(c)) return false;
      if (f === 'cdd' && !/cdd|fixed-term/i.test(c)) return false;
    }
    const score = job.grade?.overall || 0;
    if (score < currentMinScore) return false;

    if (searchQuery) {
      const text = `${job.title} ${job.company} ${job.location} ${(job.requiredSkills || []).join(' ')} ${job.workLanguage || ''}`.toLowerCase();
      if (!text.includes(searchQuery)) return false;
    }
    return true;
  });

  // Sort filtered jobs based on currentSortBy (default: 'recent' timeline first)
  filtered.sort((a, b) => {
    if (currentSortBy === 'recent') {
      const timeA = new Date(a.postedAt || a.scrapedAt || 0).getTime();
      const timeB = new Date(b.postedAt || b.scrapedAt || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return (b.grade?.overall || 0) - (a.grade?.overall || 0);
    }
    if (currentSortBy === 'score') {
      const scoreDiff = (b.grade?.overall || 0) - (a.grade?.overall || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.postedAt || b.scrapedAt || 0).getTime() - new Date(a.postedAt || a.scrapedAt || 0).getTime();
    }
    if (currentSortBy === 'startDate') {
      const aAsap = /asap|dès que possible|immediate/i.test(a.startDate || '') ? 0 : 1;
      const bAsap = /asap|dès que possible|immediate/i.test(b.startDate || '') ? 0 : 1;
      if (aAsap !== bAsap) return aAsap - bAsap;
      return new Date(b.postedAt || b.scrapedAt || 0).getTime() - new Date(a.postedAt || a.scrapedAt || 0).getTime();
    }
    return 0;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="glass-panel p-12 text-center rounded-2xl border border-white/5">
        <i data-lucide="inbox" class="w-8 h-8 text-slate-500 mx-auto mb-2"></i>
        <h3 class="text-sm font-semibold text-slate-300">No matching opportunities found</h3>
        <p class="text-xs text-slate-500 mt-1">
          ${hidePreviouslyApplied ? 'Some companies were hidden because you already applied to them or marked them as rejected. Click "Hide Applied" above to view them.' : 'Try adjusting the contract filter, lowering the minimum score slider, or clearing your search filters.'}
        </p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = filtered.map((job, idx) => {
    const score = job.grade?.overall || 0;
    let badgeClass = 'score-badge-fair';
    if (score >= 9.0) badgeClass = 'score-badge-exceptional';
    else if (score >= 7.8) badgeClass = 'score-badge-strong';
    else if (score >= 6.5) badgeClass = 'score-badge-moderate';

    const sourceColors = {
      'Welcome to the Jungle': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      'APEC': 'bg-blue-500/10 text-blue-300 border-blue-500/20',
      'LinkedIn': 'bg-sky-500/10 text-sky-300 border-sky-500/20',
      'Indeed': 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
      'France Travail': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      'HelloWork': 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      'JobTeaser': 'bg-teal-500/15 text-teal-300 border-teal-500/30',
      'Station F (MaddyJobs)': 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
      'Station F': 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30'
    };

    const sourceBadge = sourceColors[job.source] || 'bg-slate-700 text-slate-300';
    const isApplied = job.status === 'applied';
    const isRejected = job.status === 'rejected' || (job.appliedHistory?.status || '').toLowerCase().includes('reject');
    const isCDI = /cdi|permanent/i.test(job.contract || '');
    const isCDD = /cdd|fixed-term/i.test(job.contract || '');
    let contractBadgeClass = 'font-semibold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-md';
    let contractIcon = 'graduation-cap';
    if (isCDI) {
      contractBadgeClass = 'font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/35 px-2 py-0.5 rounded-md';
      contractIcon = 'briefcase';
    } else if (isCDD) {
      contractBadgeClass = 'font-bold text-cyan-300 bg-cyan-500/20 border border-cyan-500/35 px-2 py-0.5 rounded-md';
      contractIcon = 'calendar';
    }

    const hasPriorApp = job.appliedHistory?.previouslyApplied;
    const postedTimeAgo = formatTimeAgo(job.postedAt);
    const earlyBadge = getEarlyWindowBadge(job.postedAt);
    const diffHours = job.postedAt ? (Date.now() - new Date(job.postedAt).getTime()) / (1000 * 60 * 60) : 999;
    const isEarly24 = diffHours <= 24;
    const isEarly48 = diffHours <= 48;
    const earlyCardClass = isEarly24 
      ? 'border-l-4 border-l-emerald-400 shadow-emerald-500/10' 
      : isEarly48 
      ? 'border-l-4 border-l-cyan-400 shadow-cyan-500/10' 
      : '';

    const safeComp = (job.company || '').replace(/'/g, "\\'");
    const safeTitle = (job.title || '').replace(/'/g, "\\'");

    return `
      <div class="glass-card rounded-2xl p-5 relative overflow-hidden group ${earlyCardClass}">
        
        <!-- Rejected / Prior Application Anti-Overlap Alert Banner -->
        ${isRejected ? `
          <div class="mb-3.5 p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex flex-wrap items-center justify-between gap-2">
            <span class="flex items-center gap-1.5 font-semibold">
              <i data-lucide="x-circle" class="w-4 h-4 text-red-400"></i>
              In Rejected Pile: "${job.appliedHistory?.roleApplied || job.title}" at ${job.company}
            </span>
            <button onclick="restoreJobFromRejected('${job.id}', '${safeComp}')" class="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition flex items-center gap-1">
              <i data-lucide="rotate-ccw" class="w-3 h-3"></i> Restore to Active
            </button>
          </div>
        ` : hasPriorApp ? `
          <div class="mb-3.5 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex flex-wrap items-center justify-between gap-2">
            <span class="flex items-center gap-1.5 font-semibold">
              <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-400"></i>
              Previously Applied to ${job.company}: "${job.appliedHistory.roleApplied}" on ${job.appliedHistory.dateApplied}
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/25 text-amber-200 border border-amber-500/30 uppercase">
              ${job.appliedHistory.status}
            </span>
          </div>
        ` : ''}

        <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
          
          <!-- Job Details -->
          <div class="space-y-2.5 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md border ${sourceBadge}">
                ${job.source}
              </span>
              <span class="text-xs font-semibold text-white flex items-center gap-1">
                <i data-lucide="building" class="w-3.5 h-3.5 text-indigo-400"></i> ${job.company}
              </span>
              ${job.workLanguage ? `
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  🇬🇧 ${job.workLanguage}
                </span>
              ` : ''}
              <!-- Early Window & Posted Date Badges -->
              ${earlyBadge}
              <span class="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-white/10 flex items-center gap-1" title="Posted on ${job.postedAt ? new Date(job.postedAt).toLocaleDateString() : 'Recent'}">
                <i data-lucide="clock" class="w-3 h-3 text-cyan-400"></i> Posted: <strong class="text-white">${postedTimeAgo}</strong>
              </span>

              <!-- Quick Checkbox: Mark as Rejected Box -->
              <label class="flex items-center gap-1.5 px-2 py-0.5 rounded-md ${isRejected ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-slate-800/80 text-slate-400 hover:text-red-300 border border-white/10'} transition cursor-pointer text-[10px]" title="Mark this box as rejected to move into rejected pile">
                <input type="checkbox" onchange="markJobCardAsRejected('${job.id}', '${safeComp}', '${safeTitle}', this)" class="rounded bg-slate-950 border-slate-700 text-red-500 focus:ring-red-500 w-3 h-3 cursor-pointer" ${isRejected ? 'checked' : ''}>
                <span>${isRejected ? 'In Rejected Pile' : 'Reject Box'}</span>
              </label>

              ${isApplied ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✓ Applied</span>' : ''}
            </div>

            <h3 class="text-base font-bold text-white group-hover:text-indigo-300 transition">
              ${job.title}
            </h3>

            <div class="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span class="flex items-center gap-1">
                <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-500"></i> ${job.location || 'Paris'}
              </span>
              <span class="flex items-center gap-1 ${contractBadgeClass}">
                <i data-lucide="${contractIcon}" class="w-3.5 h-3.5"></i> ${job.contract || 'Alternance'}
              </span>
              <span class="flex items-center gap-1 font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                <i data-lucide="calendar" class="w-3.5 h-3.5 text-emerald-400"></i> Start: ${job.startDate || 'Dès que possible (ASAP)'}
              </span>
              <span class="flex items-center gap-1 text-emerald-400 font-semibold">
                <i data-lucide="banknote" class="w-3.5 h-3.5"></i> ${job.salary || 'Grille Alternance M2'}
              </span>
            </div>

            <!-- Expected Start Date from Description (if specified) -->
            ${job.startDateNote ? `
              <div class="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 flex items-start sm:items-center gap-2">
                <span class="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 font-bold uppercase tracking-wider text-[10px] shrink-0 flex items-center gap-1">
                  <i data-lucide="calendar-check" class="w-3 h-3 text-cyan-400"></i> Expected Start
                </span>
                <span class="text-slate-200">Mentioned in description: <strong class="text-cyan-300 font-semibold">"${job.startDateNote}"</strong></span>
              </div>
            ` : ''}

            <p class="text-xs text-slate-300 line-clamp-2 leading-relaxed">
              ${job.description || ''}
            </p>

            <!-- Required Skills Chips -->
            <div class="flex flex-wrap gap-1.5 pt-1">
              ${(job.requiredSkills || []).slice(0, 5).map(skill => `
                <span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-white/5">
                  ${skill}
                </span>
              `).join('')}
            </div>

            <!-- Strengths Summary -->
            ${job.grade?.strengths?.length ? `
              <div class="text-[11px] text-emerald-400/90 flex items-center gap-1.5 pt-1">
                <i data-lucide="check-circle-2" class="w-3.5 h-3.5 shrink-0"></i>
                <span class="truncate">${job.grade.strengths[0]}</span>
              </div>
            ` : ''}
          </div>

          <!-- Score & Action Buttons -->
          <div class="flex md:flex-col items-center md:items-end justify-between md:justify-start gap-3 shrink-0">
            
            <!-- Match Score Badge + Timeline Priority Indicator -->
            <div class="text-right flex md:flex-col items-center md:items-end gap-1.5">
              ${currentSortBy === 'recent' ? `
                <span class="text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full ${isEarly24 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20' : isEarly48 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400 border border-white/5'}">
                  #${idx + 1} Newest
                </span>
              ` : ''}
              <div class="px-3.5 py-2 rounded-2xl ${badgeClass} text-center flex md:flex-col items-center gap-1 shadow-lg">
                <span class="text-2xl font-black tracking-tight leading-none">${score.toFixed(1)}</span>
                <span class="text-[10px] uppercase font-bold tracking-wider opacity-90">/ 10</span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-wrap md:flex-col gap-1.5 w-full sm:w-auto">
              <button onclick="openCoverLetterModal('${job.id}')" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 hover:bg-indigo-600/60 transition flex items-center gap-1.5 justify-center">
                <i data-lucide="sparkles" class="w-3.5 h-3.5 text-cyan-400"></i> Cover Letter
              </button>

              <button onclick="openCvModal('${job.id}')" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 border border-white/5 hover:bg-slate-700 transition flex items-center gap-1.5 justify-center">
                <i data-lucide="target" class="w-3.5 h-3.5 text-emerald-400"></i> CV Tips
              </button>

              <button onclick="openMarkAppliedModal('${job.id}')" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition flex items-center gap-1.5 justify-center">
                <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Mark Applied
              </button>

              <!-- Mark Rejected Button -->
              ${isRejected ? `
                <button onclick="restoreJobFromRejected('${job.id}', '${safeComp}')" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 border border-white/10 hover:bg-slate-700 hover:text-white transition flex items-center gap-1.5 justify-center">
                  <i data-lucide="rotate-ccw" class="w-3.5 h-3.5 text-slate-400"></i> Restore Role
                </button>
              ` : `
                <button onclick="markJobCardAsRejected('${job.id}', '${safeComp}', '${safeTitle}')" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition flex items-center gap-1.5 justify-center" title="Move role into the Rejected pile">
                  <i data-lucide="x-circle" class="w-3.5 h-3.5 text-red-400"></i> Mark Rejected
                </button>
              `}

              <div class="flex items-center gap-1">
                <a href="${job.sourceUrl}" target="_blank" rel="noopener noreferrer" class="flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/80 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20 transition flex items-center gap-1.5 justify-center">
                  <i data-lucide="external-link" class="w-3.5 h-3.5"></i> View on ${job.source === 'Welcome to the Jungle' ? 'WTTJ' : job.source}
                </a>
                ${job.companyCareersUrl ? `
                  <a href="${job.companyCareersUrl}" target="_blank" rel="noopener noreferrer" title="Official Company Careers Site" class="p-1.5 rounded-xl text-xs font-semibold bg-slate-800/60 text-slate-400 border border-white/5 hover:text-white hover:bg-slate-700 transition flex items-center justify-center">
                    <i data-lucide="building" class="w-3.5 h-3.5"></i>
                  </a>
                ` : ''}
              </div>
            </div>

          </div>

        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Modals setup
function setupModals() {
  const modalLetter = document.getElementById('modal-cover-letter');
  const modalCv = document.getElementById('modal-cv');

  document.getElementById('btn-close-letter').addEventListener('click', () => modalLetter.classList.add('hidden'));
  document.getElementById('btn-close-cv').addEventListener('click', () => modalCv.classList.add('hidden'));
  document.getElementById('btn-close-cv-bottom').addEventListener('click', () => modalCv.classList.add('hidden'));

  // Tone Buttons
  const toneBtns = document.querySelectorAll('.letter-tone-btn');
  toneBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toneBtns.forEach(b => b.className = 'letter-tone-btn px-2.5 py-1 rounded-lg font-medium bg-slate-800 text-slate-300 hover:bg-slate-700');
      btn.className = 'letter-tone-btn px-2.5 py-1 rounded-lg font-semibold bg-indigo-600 text-white';
      currentTone = btn.dataset.tone;
      regenerateLetter();
    });
  });

  // Language Buttons
  const langBtns = document.querySelectorAll('.letter-lang-btn');
  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      langBtns.forEach(b => b.className = 'letter-lang-btn px-2.5 py-1 rounded-lg font-medium bg-slate-800 text-slate-300 hover:bg-slate-700');
      btn.className = 'letter-lang-btn px-2.5 py-1 rounded-lg font-semibold bg-indigo-600 text-white';
      currentLang = btn.dataset.lang;
      regenerateLetter();
    });
  });

  // Copy Letter
  document.getElementById('btn-copy-letter').addEventListener('click', () => {
    const text = document.getElementById('letter-textarea').value;
    navigator.clipboard.writeText(text);
    showToast('Cover letter copied to clipboard!', 'success');
  });

  // Download Letter
  document.getElementById('btn-download-letter').addEventListener('click', () => {
    const text = document.getElementById('letter-textarea').value;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cover-Letter-Lisa-Liu-${currentJobForModal?.company || 'Alternance'}.txt`;
    a.click();
    showToast('Cover letter saved to .txt', 'info');
  });

  // Send via Gmail button
  document.getElementById('btn-modal-send-gmail').addEventListener('click', sendApplicationViaGmail);

  // Mark as Applied Modal & Log Application
  const modalMarkApplied = document.getElementById('modal-mark-applied');
  const btnCloseMarkApplied = document.getElementById('btn-close-mark-applied');
  const btnCancelMarkApplied = document.getElementById('btn-cancel-mark-applied');
  const btnOpenAddApp = document.getElementById('btn-open-add-app');
  const formMarkApplied = document.getElementById('form-mark-applied');

  if (btnCloseMarkApplied) btnCloseMarkApplied.addEventListener('click', () => modalMarkApplied.classList.add('hidden'));
  if (btnCancelMarkApplied) btnCancelMarkApplied.addEventListener('click', () => modalMarkApplied.classList.add('hidden'));

  if (btnOpenAddApp) {
    btnOpenAddApp.addEventListener('click', () => {
      document.getElementById('apply-job-id').value = '';
      document.getElementById('apply-company').value = '';
      document.getElementById('apply-role').value = '';
      document.getElementById('apply-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('apply-status').value = 'Pending';
      document.getElementById('apply-notes').value = '';
      document.getElementById('apply-portal').value = '';
      modalMarkApplied.classList.remove('hidden');
    });
  }

  if (formMarkApplied) {
    formMarkApplied.addEventListener('submit', async (e) => {
      e.preventDefault();
      const jobId = document.getElementById('apply-job-id').value;
      const company = document.getElementById('apply-company').value;
      const jobTitle = document.getElementById('apply-role').value;
      const dateApplied = document.getElementById('apply-date').value;
      const status = document.getElementById('apply-status').value;
      const notes = document.getElementById('apply-notes').value;
      const portalUrl = document.getElementById('apply-portal').value;

      try {
        const res = await fetch('/api/applications/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, company, jobTitle, dateApplied, status, notes, portalUrl })
        });
        const data = await res.json();
        if (data.success) {
          modalMarkApplied.classList.add('hidden');
          showToast(`Recorded application to ${company}! Added to Anti-Overlap Tracker.`, 'success');
          await loadApplications();
          await loadJobs(); // Automatically hides or flags with anti-overlap badge!
        } else {
          showToast('Error recording application: ' + data.error, 'error');
        }
      } catch (err) {
        showToast('Failed to record application: ' + err.message, 'error');
      }
    });
  }
}

// Open Mark as Applied Modal for a specific job
window.openMarkAppliedModal = function(jobId) {
  const job = allJobs.find(j => j.id === jobId);
  if (!job) return;

  document.getElementById('apply-job-id').value = job.id;
  document.getElementById('apply-company').value = job.company;
  document.getElementById('apply-role').value = job.title;
  document.getElementById('apply-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('apply-status').value = 'Pending';
  document.getElementById('apply-notes').value = `Applied via ${job.source}`;
  document.getElementById('apply-portal').value = job.companyCareersUrl || job.sourceUrl || '';

  const modal = document.getElementById('modal-mark-applied');
  if (modal) modal.classList.remove('hidden');
};

// Open Cover Letter Modal
window.openCoverLetterModal = async function(jobId) {
  const job = allJobs.find(j => j.id === jobId);
  if (!job) return;
  currentJobForModal = job;

  document.getElementById('modal-letter-title').textContent = `${job.title} — ${job.company}`;
  document.getElementById('modal-letter-subtitle').textContent = `Targeting ${job.company} (${job.source}) • Recruiter: ${job.recruiterEmail || 'recruitment team'}`;
  document.getElementById('modal-cover-letter').classList.remove('hidden');

  await regenerateLetter();
};

async function regenerateLetter() {
  if (!currentJobForModal) return;
  const textarea = document.getElementById('letter-textarea');
  textarea.value = 'Drafting customized cover letter for Lisa Liu with AI...';

  try {
    const res = await fetch('/api/cover-letter/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job: currentJobForModal,
        tone: currentTone,
        language: currentLang
      })
    });
    const data = await res.json();
    textarea.value = data.letter || '';
  } catch (err) {
    textarea.value = 'Error generating letter: ' + err.message;
  }
}

// Open CV Suggestions Modal
window.openCvModal = async function(jobId) {
  const job = allJobs.find(j => j.id === jobId);
  if (!job) return;

  document.getElementById('modal-cv-jobtitle').textContent = `${job.title} at ${job.company}`;
  document.getElementById('modal-cv').classList.remove('hidden');

  try {
    const res = await fetch('/api/cv-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job })
    });
    const data = await res.json();

    document.getElementById('cv-ats-score').textContent = (data.atsMatchScore || 96) + '%';
    
    const kwContainer = document.getElementById('cv-missing-keywords');
    kwContainer.innerHTML = (data.missingKeywords || []).map(kw => `
      <span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-950/40 text-cyan-300 border border-cyan-500/30">
        + ${kw}
      </span>
    `).join('') || '<span class="text-xs text-emerald-400">✓ Exceptional keyword alignment!</span>';

    document.getElementById('cv-suggested-bullet').textContent = data.recommendedBullet || '';

    document.getElementById('btn-copy-bullet').onclick = () => {
      navigator.clipboard.writeText(data.recommendedBullet || '');
      showToast('Bullet point copied!', 'success');
    };

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    showToast('Failed to analyze CV: ' + err.message, 'error');
  }
};

// Dispatch via Gmail (lisalliu99@gmail.com)
async function sendApplicationViaGmail() {
  if (!currentJobForModal) return;
  const letterBody = document.getElementById('letter-textarea').value;
  const to = currentJobForModal.recruiterEmail || 'careers@' + currentJobForModal.company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  const subject = `Application: ${currentJobForModal.title} — Lisa Liu (Alternance 12M)`;

  showToast('Opening Gmail with pre-filled cover letter...', 'info');

  try {
    const res = await fetch('/api/gmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: currentJobForModal.id,
        to,
        subject,
        letterBody,
        useAppPassword: false // Always zero-password mailto for Lisa
      })
    });
    const data = await res.json();

    if (data.mode === 'mailto' || data.mailtoUrl) {
      window.open(data.mailtoUrl, '_blank');
      showToast('Opened your Gmail client with pre-filled recipient and cover letter!', 'success');
    }

    document.getElementById('modal-cover-letter').classList.add('hidden');
    await loadJobs();
    await loadApplications();
  } catch (err) {
    showToast('Failed to prepare application: ' + err.message, 'error');
  }
}

// Applications Tab & Anti-Overlap Center
async function loadApplications() {
  try {
    const res = await fetch('/api/applications');
    const data = await res.json();
    allApplications = data.applications || [];
    
    // Update badge counters
    const badge = document.getElementById('apps-count-badge');
    if (badge) badge.textContent = allApplications.length;

    const totalCounter = document.getElementById('apps-total-counter');
    if (totalCounter) totalCounter.textContent = allApplications.length;

    const statTotal = document.getElementById('app-stat-total');
    if (statTotal) statTotal.textContent = allApplications.length;

    const pendingCount = allApplications.filter(a => (a.status || a.response || '').toLowerCase().includes('pending') || !(a.status || a.response || '').toLowerCase().includes('reject') && !(a.status || a.response || '').toLowerCase().includes('expire')).length;
    const rejectedCount = allApplications.filter(a => (a.status || a.response || '').toLowerCase().includes('reject')).length;
    const expiredCount = allApplications.filter(a => (a.status || a.response || '').toLowerCase().includes('expire') || (a.status || a.response || '').toLowerCase().includes('no response')).length;

    const statPending = document.getElementById('app-stat-pending');
    if (statPending) statPending.textContent = pendingCount;

    const statRejected = document.getElementById('app-stat-rejected');
    if (statRejected) statRejected.textContent = rejectedCount;

    const statExpired = document.getElementById('app-stat-expired');
    if (statExpired) statExpired.textContent = expiredCount;

    const overlapToggleLabel = document.getElementById('overlap-toggle-label');
    if (overlapToggleLabel && hidePreviouslyApplied) {
      overlapToggleLabel.textContent = `Hide Applied (${allApplications.length})`;
    }

    renderApplicationsTable();
  } catch (err) {
    console.error('Failed to load applications:', err);
  }
}

function renderApplicationsTable() {
  const tbody = document.getElementById('apps-table-body');
  if (!tbody) return;

  let filtered = allApplications;

  if (currentAppStatusFilter === 'pending') {
    filtered = filtered.filter(a => (a.status || a.response || '').toLowerCase().includes('pending') || !(a.status || a.response || '').toLowerCase().includes('reject') && !(a.status || a.response || '').toLowerCase().includes('expire'));
  } else if (currentAppStatusFilter === 'rejected') {
    filtered = filtered.filter(a => (a.status || a.response || '').toLowerCase().includes('reject'));
  } else if (currentAppStatusFilter === 'expired') {
    filtered = filtered.filter(a => (a.status || a.response || '').toLowerCase().includes('expire') || (a.status || a.response || '').toLowerCase().includes('no response'));
  }

  if (appSearchQuery) {
    filtered = filtered.filter(a => 
      (a.company || '').toLowerCase().includes(appSearchQuery) ||
      (a.jobTitle || '').toLowerCase().includes(appSearchQuery) ||
      (a.notes || '').toLowerCase().includes(appSearchQuery)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500">No applications match your filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(app => {
    const isRejected = (app.status || app.response || '').toLowerCase().includes('reject');
    const isExpired = (app.status || app.response || '').toLowerCase().includes('expire') || (app.status || app.response || '').toLowerCase().includes('no response');
    
    let statusClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    let statusText = app.status || 'Pending';
    if (isRejected) {
      statusClass = 'bg-red-500/20 text-red-300 border-red-500/30';
      statusText = 'Rejected';
    } else if (isExpired) {
      statusClass = 'bg-slate-500/20 text-slate-300 border-slate-500/30';
      statusText = 'No Response';
    }

    const isSelected = selectedAppIds.has(app.id);

    return `
      <tr class="hover:bg-white/5 transition ${isRejected ? 'bg-red-950/10' : ''}">
        <td class="py-3 px-3 text-center">
          <input type="checkbox" class="app-row-checkbox rounded bg-slate-900 border-slate-700 text-red-500 focus:ring-red-500 cursor-pointer w-3.5 h-3.5" data-id="${app.id}" ${isSelected ? 'checked' : ''}>
        </td>
        <td class="py-3 px-4 font-bold text-white flex items-center gap-2">
          <i data-lucide="building" class="w-3.5 h-3.5 text-indigo-400"></i> ${app.company}
        </td>
        <td class="py-3 px-4 text-slate-200 font-medium">${app.jobTitle}</td>
        <td class="py-3 px-4 text-slate-400 font-mono">${app.dateApplied || '2026-08'}</td>
        <td class="py-3 px-4">
          <div class="flex items-center gap-1.5">
            <select onchange="updateApplicationStatusFromUI('${app.id}', this.value)" class="text-[10px] font-bold rounded-lg px-2 py-0.5 border ${statusClass} bg-slate-900/90 cursor-pointer hover:border-white/30 transition">
              <option value="Pending" ${statusText === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
              <option value="Rejected" ${statusText === 'Rejected' ? 'selected' : ''}>❌ Rejected</option>
              <option value="Interview" ${statusText === 'Interview' ? 'selected' : ''}>🎯 Interview</option>
              <option value="No Response" ${statusText === 'No Response' ? 'selected' : ''}>⌛ Expired</option>
            </select>
          </div>
        </td>
        <td class="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate" title="${app.notes || ''}">
          ${app.notes ? `
            <span class="flex items-center gap-1 text-slate-300">
              <i data-lucide="message-square" class="w-3 h-3 text-cyan-400"></i> ${app.notes}
            </span>
          ` : '<span class="text-slate-600">—</span>'}
        </td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            ${!isRejected ? `
              <button onclick="updateApplicationStatusFromUI('${app.id}', 'Rejected')" class="px-2 py-1 rounded-lg text-[10px] font-bold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition flex items-center gap-1" title="Mark role as rejected and move to rejected pile">
                <i data-lucide="x-circle" class="w-3 h-3 text-red-400"></i> Reject
              </button>
            ` : `
              <button onclick="updateApplicationStatusFromUI('${app.id}', 'Pending')" class="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-800 text-slate-300 border border-white/10 hover:bg-slate-700 transition flex items-center gap-1" title="Restore to Pending">
                <i data-lucide="rotate-ccw" class="w-3 h-3 text-slate-400"></i> Restore
              </button>
            `}
            ${app.portalUrl ? `
              <a href="${app.portalUrl}" target="_blank" rel="noopener noreferrer" class="px-2 py-1 rounded-lg text-[10px] font-semibold bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/50 transition inline-flex items-center gap-1">
                <i data-lucide="external-link" class="w-3 h-3"></i> Portal
              </a>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach checkbox listeners
  const checkboxes = tbody.querySelectorAll('.app-row-checkbox');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) selectedAppIds.add(id);
      else selectedAppIds.delete(id);
      updateBatchBar();
    });
  });

  updateBatchBar();
  if (window.lucide) lucide.createIcons();
}

// Setup Batch Selection Actions in Applications Tracker
function setupBatchActions() {
  const selectAll = document.getElementById('apps-select-all');
  const btnBatchReject = document.getElementById('btn-batch-reject');
  const btnBatchPending = document.getElementById('btn-batch-pending');
  const btnBatchClear = document.getElementById('btn-batch-clear');

  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const checkboxes = document.querySelectorAll('.app-row-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = isChecked;
        const id = cb.dataset.id;
        if (id) {
          if (isChecked) selectedAppIds.add(id);
          else selectedAppIds.delete(id);
        }
      });
      updateBatchBar();
    });
  }

  if (btnBatchReject) {
    btnBatchReject.addEventListener('click', async () => {
      if (selectedAppIds.size === 0) return;
      const ids = Array.from(selectedAppIds);
      await bulkUpdateStatus(ids, 'Rejected');
    });
  }

  if (btnBatchPending) {
    btnBatchPending.addEventListener('click', async () => {
      if (selectedAppIds.size === 0) return;
      const ids = Array.from(selectedAppIds);
      await bulkUpdateStatus(ids, 'Pending');
    });
  }

  if (btnBatchClear) {
    btnBatchClear.addEventListener('click', () => {
      selectedAppIds.clear();
      if (selectAll) selectAll.checked = false;
      renderApplicationsTable();
      updateBatchBar();
    });
  }
}

function updateBatchBar() {
  const batchBar = document.getElementById('apps-batch-bar');
  const batchCount = document.getElementById('apps-batch-count');
  if (!batchBar || !batchCount) return;

  if (selectedAppIds.size > 0) {
    batchBar.classList.remove('hidden');
    batchCount.textContent = selectedAppIds.size;
  } else {
    batchBar.classList.add('hidden');
    batchCount.textContent = '0';
  }
}

async function bulkUpdateStatus(ids, status) {
  try {
    showToast(`Moving ${ids.length} role(s) into the ${status} pile...`, 'info');
    const res = await fetch('/api/applications/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Moved ${data.updatedCount || ids.length} role(s) into the ${status} pile!`, 'success');
      selectedAppIds.clear();
      const selectAll = document.getElementById('apps-select-all');
      if (selectAll) selectAll.checked = false;
      await loadApplications();
      await loadJobs();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed to update roles: ' + err.message, 'error');
  }
}

// Single-item update from UI dropdown or quick reject button
window.updateApplicationStatusFromUI = async function(appId, newStatus) {
  try {
    showToast(`Updating role status to ${newStatus}...`, 'info');
    const res = await fetch('/api/applications/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: appId, status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Role moved into ${newStatus} pile!`, 'success');
      await loadApplications();
      await loadJobs();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed to update: ' + err.message, 'error');
  }
};

// Directly mark a job card as rejected from search feed
window.markJobCardAsRejected = async function(jobId, company, jobTitle, checkboxEl) {
  try {
    showToast(`Moving ${company} into the rejected pile...`, 'info');
    const res = await fetch('/api/jobs/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, company, jobTitle })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Moved ${company} (${jobTitle}) into the Rejected pile!`, 'success');
      await loadJobs();
      await loadApplications();
    } else {
      if (checkboxEl) checkboxEl.checked = false;
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    if (checkboxEl) checkboxEl.checked = false;
    showToast('Failed to mark rejected: ' + err.message, 'error');
  }
};

// Restore a rejected job back to active
window.restoreJobFromRejected = async function(jobId, company) {
  try {
    showToast(`Restoring ${company} to active...`, 'info');
    await fetch('/api/applications/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: company, status: 'Pending' })
    });
    if (jobId) {
      await fetch('/api/jobs/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: 'new' })
      });
    }
    showToast(`Restored ${company} to active!`, 'success');
    await loadJobs();
    await loadApplications();
  } catch (err) {
    showToast('Failed to restore: ' + err.message, 'error');
  }
};

// Profile Management
async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    currentProfile = await res.json();

    document.getElementById('prof-name').value = currentProfile.name || 'Lisa Liu';
    document.getElementById('prof-email').value = currentProfile.email || 'lisalliu99@gmail.com';
    document.getElementById('prof-headline').value = currentProfile.headline || '';
    document.getElementById('prof-location').value = currentProfile.location || 'Saint-Maur-des-Fossés / Paris (RER A)';
    document.getElementById('prof-website').value = currentProfile.website || 'https://lisa.bleuh.fr/';
    document.getElementById('prof-school').value = currentProfile.school || 'INSEEC Paris — M2 Digital Marketing & E-Commerce';
    document.getElementById('prof-rhythm').value = typeof currentProfile.scheduleRhythm === 'object' 
      ? `${currentProfile.scheduleRhythm.schoolDays} / ${currentProfile.scheduleRhythm.workDays}`
      : currentProfile.scheduleRhythm || '3j école (Lun-Mer) / 2j entreprise (Jeu-Ven)';
    document.getElementById('prof-avail').value = currentProfile.availability || 'Disponible immédiatement / Available immediately (ASAP)';
    document.getElementById('prof-skills').value = (currentProfile.skills || []).join(', ');
    document.getElementById('prof-summary').value = currentProfile.summary || '';

    // Profile Form Submit
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const updated = {
        name: document.getElementById('prof-name').value,
        email: document.getElementById('prof-email').value,
        headline: document.getElementById('prof-headline').value,
        location: document.getElementById('prof-location').value,
        website: document.getElementById('prof-website').value,
        school: document.getElementById('prof-school').value,
        scheduleRhythm: document.getElementById('prof-rhythm').value,
        availability: document.getElementById('prof-avail').value,
        skills: document.getElementById('prof-skills').value.split(',').map(s => s.trim()),
        summary: document.getElementById('prof-summary').value
      };

      const saveRes = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const resData = await saveRes.json();
      if (resData.success) {
        showToast('Profile updated!', 'success');
        currentProfile = updated;
        await loadJobs();
      }
    });

  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

// Scheduler Status & Countdown
async function updateSchedulerStatus() {
  try {
    const res = await fetch('/api/cron/status');
    const data = await res.json();
    if (data.countdown) {
      document.getElementById('stat-next-run').textContent = `Next scan in ${data.countdown} (09:00, 17:00)`;
    }
  } catch (err) {
    console.error('Failed to update scheduler status:', err);
  }
}
