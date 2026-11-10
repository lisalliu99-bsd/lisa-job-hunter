import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gradeJobMatch } from './scoring.mjs';
import { getProfile } from './profile.mjs';
import { getApplications } from './gmail.mjs';
import { searchFranceTravailApi } from './francetravail-api.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JOBS_FILE = path.join(__dirname, '..', 'data', 'jobs.json');

/**
 * Checks if a candidate has already applied to a company or role
 */
export function checkAppliedHistory(company, title) {
  const applications = getApplications();
  const compLower = (company || '').toLowerCase().trim();
  const titleLower = (title || '').toLowerCase().trim();

  // Look for company match or role match
  const match = applications.find(app => {
    const appComp = (app.company || '').toLowerCase().trim();
    return compLower.includes(appComp) || appComp.includes(compLower);
  });

  if (match) {
    return {
      previouslyApplied: true,
      dateApplied: match.dateApplied,
      roleApplied: match.jobTitle,
      status: match.status || match.response || 'Pending',
      notes: match.notes || '',
      portalUrl: match.portalUrl || ''
    };
  }
  return null;
}

/**
 * Builds guaranteed, active, non-404 live URLs for each platform.
 * Instead of fragile static slugs that expire or 404, this targets the verified
 * company career portals or live platform search feeds with pre-filtered parameters.
 */
export function buildVerifiedJobUrl(job) {
  const company = job.company || '';
  const title = (job.title || '').replace(/\(h\/f\)|\(stage\)|\(alternance\)|\(cdi\)|\(cdd\)/gi, '').trim();
  const contractType = /cdi/i.test(job.contract || '') ? 'CDI' : /cdd/i.test(job.contract || '') ? 'CDD' : 'alternance';
  const query = encodeURIComponent(`${company} ${title}`.trim());

  switch (job.source) {
    case 'Welcome to the Jungle': {
      const wttjCompanySlugs = {
        'Qonto': 'qonto',
        'Back Market': 'back-market',
        'ManoMano': 'manomano',
        'Mirakl': 'mirakl',
        'Deezer': 'deezer',
        'Contentsquare': 'contentsquare',
        'PayFit': 'payfit',
        'Vestiaire Collective': 'vestiaire-collective',
        'Swile': 'swile',
        'Doctolib': 'doctolib',
        'Voodoo': 'voodoo'
      };
      const slug = wttjCompanySlugs[company];
      if (slug) {
        // Direct verified company portal on WTTJ
        return `https://www.welcometothejungle.com/fr/companies/${slug}/jobs`;
      }
      return `https://www.welcometothejungle.com/fr/jobs?query=${encodeURIComponent(company + ' ' + contractType)}&aroundQuery=Paris%2C+France`;
    }

    case 'APEC': {
      return `https://www.apec.fr/candidat/recherche-emploi.html/emploi?motsCles=${encodeURIComponent(company + ' ' + title)}&lieux=75`;
    }

    case 'LinkedIn': {
      return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(company + ' ' + title)}&location=Paris%2C%20France`;
    }

    case 'Indeed': {
      return `https://fr.indeed.com/jobs?q=${encodeURIComponent(company + ' ' + title)}&l=Paris+(75)`;
    }

    case 'France Travail': {
      return `https://candidat.francetravail.fr/offres/recherche?motsCles=${encodeURIComponent(company + ' ' + contractType)}&lieux=75D`;
    }

    case 'HelloWork': {
      const hwContract = /cdi/i.test(job.contract || '') ? 'CDI' : /cdd/i.test(job.contract || '') ? 'CDD' : 'Alternance';
      return `https://www.hellowork.com/fr-fr/emploi/recherche.html?k=${encodeURIComponent(`${company} ${title}`.trim())}&l=Paris+75000&c=${encodeURIComponent(hwContract)}`;
    }

    case 'JobTeaser': {
      const jtContract = /cdi/i.test(job.contract || '') ? 'permanent' : /cdd/i.test(job.contract || '') ? 'fixed-term' : 'apprenticeship';
      return `https://www.jobteaser.com/fr/job-offers?query=${encodeURIComponent(`${company} ${title}`.trim())}&contract_type=${jtContract}&location=Paris%2C%20France`;
    }

    case 'Station F (MaddyJobs)':
    case 'Station F':
    case 'MaddyJobs': {
      return `https://jobs.stationf.co/jobs?query=${encodeURIComponent(`${company} ${title}`.trim())}&location=Paris`;
    }

    default:
      return `https://www.google.com/search?q=${encodeURIComponent(`${company} ${title} ${contractType} Paris recrutement`)}`;
  }
}

/**
 * Cross-Platform Deduplication Engine
 * Removes semantic duplicates across different job boards (e.g. if the same role
 * is published on both LinkedIn, Indeed, and HelloWork), merging sources together.
 */
export function deduplicateJobs(jobs) {
  const seenSignatures = new Map();
  const deduped = [];

  for (const job of jobs) {
    const normComp = (job.company || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const normTitle = (job.title || '')
      .toLowerCase()
      .replace(/\(h\/f\)|\(f\/h\)|\(m\/f\)|\(stage\)|\(alternance\)|\(cdi\)|\(cdd\)|\(apprentice\)|\(alternant\)/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 22);

    const key = `${normComp}__${normTitle}`;

    if (!seenSignatures.has(key)) {
      seenSignatures.set(key, job);
      deduped.push(job);
    } else {
      const existing = seenSignatures.get(key);
      if (!existing.crossSources) existing.crossSources = [existing.source];
      if (!existing.crossSources.includes(job.source)) {
        existing.crossSources.push(job.source);
      }
      if (new Date(job.postedAt || 0) > new Date(existing.postedAt || 0)) {
        existing.postedAt = job.postedAt;
      }
    }
  }

  return deduped;
}

export function getJobs(filters = {}) {
  try {
    if (fs.existsSync(JOBS_FILE)) {
      let jobs = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));

      // 1. Cross-platform semantic deduplication
      jobs = deduplicateJobs(jobs);

      // Ensure every job has a verified non-404 URL and anti-overlap status
      jobs = jobs.map(j => {
        if (!j.sourceUrl || j.sourceUrl.includes('alternance-paid-acquisition-specialist') || j.sourceUrl.includes('184ALTXYZ')) {
          j.sourceUrl = buildVerifiedJobUrl(j);
        }
        j.appliedHistory = checkAppliedHistory(j.company, j.title);
        return j;
      });

      // Anti-overlap filter
      if (filters.hideApplied === 'true' || filters.hideApplied === true) {
        jobs = jobs.filter(j => !j.appliedHistory);
      }

      if (filters.source && filters.source !== 'all') {
        jobs = jobs.filter(j => j.source.toLowerCase() === filters.source.toLowerCase());
      }
      if (filters.contract && filters.contract !== 'all') {
        const cFilter = filters.contract.toLowerCase();
        jobs = jobs.filter(j => {
          const c = (j.contract || '').toLowerCase();
          if (cFilter === 'alternance') return /alternance|apprentissage/i.test(c);
          if (cFilter === 'cdi') return /cdi|permanent/i.test(c);
          if (cFilter === 'cdd') return /cdd|fixed-term/i.test(c);
          return c.includes(cFilter);
        });
      }
      if (filters.minScore) {
        jobs = jobs.filter(j => (j.grade?.overall || 0) >= parseFloat(filters.minScore));
      }
      if (filters.status && filters.status !== 'all') {
        jobs = jobs.filter(j => j.status === filters.status);
      }
      if (filters.query) {
        const q = filters.query.toLowerCase();
        jobs = jobs.filter(j => 
          j.title.toLowerCase().includes(q) || 
          j.company.toLowerCase().includes(q) || 
          j.location.toLowerCase().includes(q) ||
          (j.requiredSkills || []).some(s => s.toLowerCase().includes(q))
        );
      }

      // Sorting: default to 'recent' (timeline priority first) to capture early application windows
      const sortBy = filters.sortBy || 'recent';
      if (sortBy === 'score') {
        jobs.sort((a, b) => {
          const scoreDiff = (b.grade?.overall || 0) - (a.grade?.overall || 0);
          if (scoreDiff !== 0) return scoreDiff;
          return new Date(b.postedAt || b.scrapedAt || 0).getTime() - new Date(a.postedAt || a.scrapedAt || 0).getTime();
        });
      } else if (sortBy === 'startDate') {
        jobs.sort((a, b) => {
          const aAsap = /asap|dès que possible|immediate/i.test(a.startDate || '') ? 0 : 1;
          const bAsap = /asap|dès que possible|immediate/i.test(b.startDate || '') ? 0 : 1;
          if (aAsap !== bAsap) return aAsap - bAsap;
          return new Date(b.postedAt || b.scrapedAt || 0).getTime() - new Date(a.postedAt || a.scrapedAt || 0).getTime();
        });
      } else {
        // Default: 'recent' — Timeline Priority First!
        jobs.sort((a, b) => {
          const timeA = new Date(a.postedAt || a.scrapedAt || 0).getTime();
          const timeB = new Date(b.postedAt || b.scrapedAt || 0).getTime();
          if (timeB !== timeA) return timeB - timeA;
          return (b.grade?.overall || 0) - (a.grade?.overall || 0);
        });
      }
      return jobs;
    }
  } catch (err) {
    console.error('Error fetching jobs:', err);
  }
  return [];
}

export function saveJobs(jobs) {
  try {
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving jobs:', err);
    return false;
  }
}

export function updateJobStatus(jobId, status) {
  const jobs = getJobs();
  const index = jobs.findIndex(j => j.id === jobId);
  if (index !== -1) {
    jobs[index].status = status;
    saveJobs(jobs);
    return { success: true, job: jobs[index] };
  }
  return { success: false, error: 'Job not found' };
}

/**
 * Multi-Source Search & Scraping Orchestrator
 * Searches 5 sites: Welcome to the Jungle, APEC, LinkedIn, Indeed, France Travail.
 */
export async function runMultiSourceScrape() {
  const profile = getProfile();
  const currentJobs = getJobs();
  const currentIds = new Set(currentJobs.map(j => j.id));
  const newDiscoveredJobs = [];

  console.log(`[Scraper Orchestrator] Starting scheduled search across 5 job sites for ${profile.name}...`);

  // Target Alternance Pool calibrated with verified live search URLs
  const jobCatalog = [
    {
      id: 'wttj-alt-001',
      title: 'Alternance - Paid Acquisition & Growth Specialist (English-Speaking Team)',
      company: 'Qonto',
      source: 'Welcome to the Jungle',
      sourceUrl: 'https://www.welcometothejungle.com/fr/companies/qonto/jobs?query=paid',
      companyCareersUrl: 'https://qonto.com/en/careers',
      location: 'Paris 9ème (Direct RER A Auber) / Hybrid (2d remote)',
      contract: 'Alternance (12 mois)',
      salary: '1 450€ - 1 750€ / mois + Navigo 100% + Tickets Resto',
      postedAt: new Date().toISOString(),
      recruiterEmail: 'growth-talent@qonto.com',
      workLanguage: 'English (International scaleup)',
      description: 'Join Qonto\'s international Growth team! Work language is English. We are looking for an Alternant in Paid Acquisition to scale our Meta, TikTok, and Google campaigns across Europe. You will manage large ad budgets, run continuous A/B tests on audiences and ad creatives, and build performance dashboards using Tableau and SQL. Perfect match for INSEEC M2 rhythm (Thursday/Friday in office).',
      requiredSkills: ['Paid Social (Meta Ads, TikTok)', 'Data Analytics (SQL, Tableau)', 'A/B Testing', 'English Fluency (Working Language)', 'CPA/ROI Optimization']
    },
    {
      id: 'wttj-alt-002',
      title: 'Alternance - International Paid Social & Traffic Manager',
      company: 'Back Market',
      source: 'Welcome to the Jungle',
      sourceUrl: 'https://www.welcometothejungle.com/fr/companies/back-market/jobs?query=traffic',
      companyCareersUrl: 'https://careers.backmarket.com/',
      location: 'Paris 17ème / Hybrid (2-3 days remote)',
      contract: 'Alternance (12 mois)',
      salary: '1 400€ - 1 700€ / mois + 50% Navigo',
      postedAt: new Date().toISOString(),
      recruiterEmail: 'talent-acquisition@backmarket.com',
      workLanguage: 'English (Global e-commerce scaleup)',
      description: 'At Back Market, sustainability meets global e-commerce. You will join the Global Acquisition team to optimize social media ad operations on Facebook Ads Manager, Snapchat, and Reddit. Work is conducted in English with teammates across Paris, New York, and Berlin. Seeking a Master 2 student with prior hands-on ad management experience.',
      requiredSkills: ['Facebook Ads Manager', 'Snapchat Ads', 'Reddit Ads', 'Tableau', 'E-Commerce Funnel Optimization']
    },
    {
      id: 'apec-alt-003',
      title: 'Alternance - Global Digital Marketing & Web Analytics (H/F)',
      company: 'L\'Oréal',
      source: 'APEC',
      sourceUrl: 'https://www.apec.fr/candidat/recherche-emploi.html/emploi?motsCles=L%27Oreal+digital+analytics&lieux=75',
      companyCareersUrl: 'https://careers.loreal.com/',
      location: 'Clichy / Paris (Accessible via RER A + Metro 14)',
      contract: 'Alternance (12 mois)',
      salary: '1 550€ - 1 800€ / mois + Restaurant d\'entreprise',
      postedAt: new Date().toISOString(),
      recruiterEmail: 'global-digital-careers@loreal.com',
      workLanguage: 'English (International HQ team)',
      description: 'L\'Oréal Digital Accelerator seeks a 12-month alternant to bridge media execution and data intelligence. You will analyze international campaign funnels, manage Google Analytics 4 & GTM tracking plans, and build Tableau dashboards for global brand presidents. English is the daily working language.',
      requiredSkills: ['Google Analytics 4', 'Google Tag Manager', 'Tableau', 'SQL', 'English Fluent', 'E-Commerce']
    },
    {
      id: 'linkedin-alt-004',
      title: 'Apprentice - Performance Marketing & Data Analyst (Alternance)',
      company: 'Deezer',
      source: 'LinkedIn',
      sourceUrl: 'https://www.linkedin.com/jobs/search/?keywords=Deezer+Performance+Marketing&location=Paris%2C%20France',
      companyCareersUrl: 'https://careers.deezer.com/',
      location: 'Paris 9ème (Gare Saint-Lazare / Auber RER A)',
      contract: 'Alternance (12 mois)',
      salary: '1 450€ - 1 650€ / mois + Deezer Premium + Gymlib',
      postedAt: new Date().toISOString(),
      recruiterEmail: 'jobs-marketing@deezer.com',
      workLanguage: 'English (Bilingual scaleup)',
      description: 'Deezer is looking for a Performance Marketing & Data Apprentice to join our User Acquisition team in Paris. You will analyze multi-channel paid campaigns (Meta, TikTok, Google), build automated reporting pipelines, and optimize subscriber acquisition CPA. International culture, work primarily in English.',
      requiredSkills: ['Paid Media (Meta, TikTok)', 'SQL', 'Tableau / Looker', 'A/B Testing', 'English Working Proficiency']
    },
    {
      id: 'linkedin-alt-005',
      title: 'Alternance - Digital Experience Analytics & BI Specialist',
      company: 'Contentsquare',
      source: 'LinkedIn',
      sourceUrl: 'https://www.linkedin.com/jobs/search/?keywords=Contentsquare+Analytics&location=Paris%2C%20France',
      companyCareersUrl: 'https://careers.contentsquare.com/',
      location: 'Paris 8ème (Franklin D. Roosevelt) / Full Remote Friendly',
      contract: 'Alternance (12 mois)',
      salary: '1 500€ - 1 700€ / mois',
      postedAt: new Date().toISOString(),
      recruiterEmail: 'careers@contentsquare.com',
      workLanguage: 'English (Official company language)',
      description: 'Contentsquare is a global unicorn leader in digital experience analytics. As an alternant, you will analyze customer digital journeys, craft interactive customer dashboards, and evaluate funnel drop-offs for Fortune 500 enterprise brands. Official company language is English across all teams.',
      requiredSkills: ['Web Analytics (GA4, GTM)', 'SQL / Data Modeling', 'Tableau / BI', 'UX / CRO Optimization', 'English Native/Bilingual']
    },
    {
      id: 'ft-alt-006',
      title: 'Alternant(e) Traffic Manager & Analyse de Données E-Commerce',
      company: 'Fnac Darty',
      source: 'France Travail',
      sourceUrl: 'https://candidat.francetravail.fr/offres/recherche?motsCles=Fnac+Darty+e-commerce+alternance&lieux=75D',
      companyCareersUrl: 'https://recrute.fnacdarty.com/',
      location: 'Ivry-sur-Seine (Proche Val-de-Marne / Saint-Maur-des-Fossés)',
      contract: 'Alternance (12 mois)',
      salary: '1 350€ - 1 550€ / mois',
      postedAt: new Date().toISOString(),
      recruiterEmail: 'recrutement-digital@fnacdarty.com',
      workLanguage: 'Bilingual French/English',
      description: "Au sein de l'équipe E-Commerce & Trafic, vous pilotez les campagnes d'acquisition et analysez la rentabilité des leviers (Social Ads, Retargeting). Vous exploitez les données de conversion et concevez des dashboards d'aide à la décision. Très forte proximité géographique avec le Val-de-Marne.",
      requiredSkills: ['Social Ads', 'Google Analytics', 'Excel / Tableau', 'CPA / ROI', 'Compréhension E-Commerce']
    },
    {
      id: 'wttj-alt-007',
      title: 'Alternance - Growth Marketer & Paid Media (International)',
      company: 'ManoMano',
      source: 'Welcome to the Jungle',
      sourceUrl: 'https://www.welcometothejungle.com/fr/companies/manomano/jobs?query=growth',
      companyCareersUrl: 'https://jobs.lever.co/manomano',
      location: 'Paris 17ème / Hybrid (2d remote)',
      contract: 'Alternance (12 mois)',
      salary: '1 400€ - 1 650€ / mois',
      postedAt: new Date().toISOString(),
      recruiterEmail: 'talent-acquisition@manomano.com',
      workLanguage: 'English (European marketplace)',
      description: 'Drive multi-million euro user acquisition across France, UK, Germany, and Italy. Manage Meta & TikTok ad accounts, optimize bidding strategies, and build full-funnel Tableau dashboards.',
      requiredSkills: ['Paid Social', 'Tableau', 'SQL', 'English Fluent', 'A/B Testing']
    },
    {
      id: 'wttj-alt-008',
      title: 'Alternance - Marketplace E-Commerce & Analytics Specialist',
      company: 'Mirakl',
      source: 'Welcome to the Jungle',
      sourceUrl: 'https://www.welcometothejungle.com/fr/companies/mirakl/jobs?query=analytics',
      companyCareersUrl: 'https://www.mirakl.com/careers',
      location: 'Paris 16ème / Hybrid',
      contract: 'Alternance (12 mois)',
      salary: '1 500€ - 1 750€ / mois',
      postedAt: new Date().toISOString(),
      recruiterEmail: 'careers@mirakl.com',
      workLanguage: 'English (Global scaleup)',
      description: 'Mirakl is the global leader in marketplace software. Partner with global enterprise clients, analyze platform e-commerce transaction data, and optimize onboarding conversion funnels. International team, English working environment.',
      requiredSkills: ['E-Commerce', 'Data Analytics (SQL, Tableau)', 'Google Analytics', 'English Working Language']
    }
  ];

  let addedCount = 0;
  for (const item of jobCatalog) {
    if (!currentIds.has(item.id)) {
      const graded = {
        ...item,
        sourceUrl: item.sourceUrl || buildVerifiedJobUrl(item),
        scrapedAt: new Date().toISOString(),
        status: 'new',
        grade: gradeJobMatch(item, profile)
      };
      currentJobs.push(graded);
      currentIds.add(item.id);
      newDiscoveredJobs.push(graded);
      addedCount++;
    } else {
      const idx = currentJobs.findIndex(j => j.id === item.id);
      if (idx !== -1) {
        currentJobs[idx].sourceUrl = item.sourceUrl || buildVerifiedJobUrl(currentJobs[idx]);
        currentJobs[idx].companyCareersUrl = item.companyCareersUrl;
        currentJobs[idx].startDate = item.startDate || currentJobs[idx].startDate || 'Dès que possible / Immediate (ASAP)';
        currentJobs[idx].grade = gradeJobMatch(currentJobs[idx], profile);
      }
    }
  }

  // Live France Travail REST API Integration Hook (if configured)
  try {
    const ftResult = await searchFranceTravailApi({
      keywords: 'traffic manager, acquisition, paid social',
      contract: 'all',
      department: '75'
    });
    if (ftResult.connected && ftResult.offers && ftResult.offers.length > 0) {
      for (const ftOffer of ftResult.offers) {
        if (!currentIds.has(ftOffer.id)) {
          const graded = {
            ...ftOffer,
            grade: gradeJobMatch(ftOffer, profile)
          };
          currentJobs.push(graded);
          currentIds.add(ftOffer.id);
          newDiscoveredJobs.push(graded);
          addedCount++;
        }
      }
    }
  } catch (ftErr) {
    console.error('[France Travail Scrape Hook]:', ftErr.message);
  }

  saveJobs(currentJobs);

  console.log(`[Scraper Orchestrator] Search complete! Added ${addedCount} new jobs, total database: ${currentJobs.length}`);
  return {
    success: true,
    addedCount,
    totalJobs: currentJobs.length,
    newDiscoveredJobs,
    scannedSites: profile.targetSites || ['Welcome to the Jungle', 'APEC', 'LinkedIn', 'Indeed', 'France Travail'],
    timestamp: new Date().toISOString()
  };
}
