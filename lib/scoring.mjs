/**
 * AI Compatibility Scoring Engine (1.0 to 10.0 scale)
 * Tailored specifically for Lisa Liu:
 * - Master 2 INSEEC Paris Alternance (12 months from Oct 2026, Thu-Fri work rhythm)
 * - Paid Media ($1.3M+/mo spend), Data Analytics (SQL, GA4, Tableau), E-Commerce
 * - International / English-speaking work environment preference
 * - Location: Saint-Maur-des-Fossés (94) / Paris (RER A) / Remote
 */

export function gradeJobMatch(job, profile) {
  const jobText = `${job.title} ${job.description} ${(job.requiredSkills || []).join(' ')} ${job.location || ''}`.toLowerCase();
  
  // 1. Contract Compatibility (Weight: 25%)
  // Supports Alternance, CDI, and CDD contracts
  let contractScore = 8.0;
  const contractLower = (job.contract || '').toLowerCase();
  const isAlternance = /alternance|apprentissage|contrat pro|student|internship|stage/i.test(jobText) || 
                       /alternance|apprentissage/i.test(contractLower);
  const isCDI = /cdi|permanent|full-time|temps plein/i.test(contractLower) || /\bcdi\b/i.test(jobText);
  const isCDD = /cdd|fixed-term|temporaire/i.test(contractLower) || /\bcdd\b/i.test(jobText);

  if (isAlternance) {
    contractScore = 9.8; // Direct match for INSEEC M2 rhythm
  } else if (isCDI) {
    // CDI contract: highly valued, especially for Junior / Associate roles matching Lisa's $1.3M+ RV experience
    contractScore = /junior|associate|specialist|manager/i.test(jobText) ? 9.8 : 9.3;
  } else if (isCDD) {
    // CDD contract: fixed-term opportunity with immediate start
    contractScore = 9.5;
  } else {
    contractScore = 8.0;
  }

  // 2. English / International Environment Alignment (Weight: 25%)
  // Lisa prefers international environments where work is conducted in English.
  let languageScore = 7.0;
  const isEnglishPost = !/le |la |nous |vous |dans /i.test(job.description.slice(0, 100)) || 
                        /english|international|bilingual|scale-up|anglophone/i.test(jobText);
  const requiresPureFrench = /français parfait exigé|maîtrise irréprochable du français oral|relations publiques france/i.test(jobText);

  if (isEnglishPost && !requiresPureFrench) {
    languageScore = 10.0; // Perfect match for Lisa's Native English superpower
  } else if (/anglais courant|bilingue|international/i.test(jobText)) {
    languageScore = 9.2;
  } else if (requiresPureFrench) {
    languageScore = 4.0; // Mismatch with preference
  } else {
    languageScore = 7.5;
  }

  // 3. Technical & Marketing Skills Match (Weight: 30%)
  const coreCompetencies = [
    'paid media', 'paid social', 'facebook ads', 'meta ads', 'tiktok ads', 'snapchat', 
    'traffic manager', 'acquisition', 'cpa', 'roi', 'a/b test', 'web analytics', 
    'google analytics', 'ga4', 'gtm', 'sql', 'tableau', 'dashboard', 'e-commerce', 
    'cro', 'seo', 'reporting', 'datagrip', 'd-edge'
  ];

  const matchedSkills = coreCompetencies.filter(comp => jobText.includes(comp));
  const skillRatio = Math.min(1.0, matchedSkills.length / 4);
  const techSkillsScore = Math.min(10.0, 5.0 + skillRatio * 5.0);

  // 4. Location & Commute / Remote (Weight: 10%)
  // Lisa is based in Saint-Maur-des-Fossés (RER A) and prefers Paris or Hybrid/Remote.
  let locationScore = 8.0;
  const isSaintMaurOrRerA = /saint-maur|nation|gare de lyon|châtelet|auber|étoile|la défense|vincennes|fontenay/i.test(jobText);
  const isParis = /paris|île-de-france|94|92|75/i.test(job.location || '');
  const isRemote = /remote|télétravail|hybrid/i.test(jobText) || /remote|télétravail/i.test(job.location || '');

  if (isRemote || isSaintMaurOrRerA) {
    locationScore = 9.8;
  } else if (isParis) {
    locationScore = 9.2;
  } else {
    locationScore = 5.5;
  }

  // 5. Growth, Mentorship & Learning On The Job (Weight: 10%)
  let learningScore = 8.5;
  if (/mentorship|formation|learn|scale|innovative|fast-paced|accompagnement/i.test(jobText)) {
    learningScore = 9.7;
  }

  // Calculate Weighted Overall Score (1.0 to 10.0)
  const overall = (
    contractScore * 0.25 +
    languageScore * 0.25 +
    techSkillsScore * 0.30 +
    locationScore * 0.10 +
    learningScore * 0.10
  );

  const roundedOverall = Math.round(overall * 10) / 10;

  // Determine Tier
  let tier = 'Moderate Match';
  if (roundedOverall >= 9.0) tier = 'Exceptional Match';
  else if (roundedOverall >= 7.8) tier = 'Strong Match';
  else if (roundedOverall < 6.0) tier = 'Low Alignment';

  // Specific Strengths for Lisa
  const strengths = [];
  const gaps = [];
  const recommendedActions = [];

  if (isAlternance) {
    strengths.push('Direct 12-month alternance opportunity matching INSEEC Paris M2 rhythm (Thu-Fri work)');
  } else if (isCDI) {
    strengths.push('Permanent CDI contract leveraging Lisa\'s 3+ years hands-on Paid Social ($1.3M+/mo) and Tableau BI analytics');
  } else if (isCDD) {
    strengths.push('Fixed-term CDD contract with immediate start flexibility');
  }
  if (languageScore >= 9.0) {
    strengths.push('International / English-speaking team environment — Lisa\'s Native English is a major competitive advantage');
  }
  if (matchedSkills.length > 0) {
    strengths.push(`Direct hit on core skills: ${matchedSkills.slice(0, 3).map(capitalize).join(', ')} (Red Ventures $1.3M+ budget & Tableau analytics)`);
  }
  if (isRemote || isSaintMaurOrRerA) {
    strengths.push(`Convenient commute from Saint-Maur-des-Fossés (RER A corridor) or hybrid remote policy`);
  }

  // Actionable tips & suggestions
  if (matchedSkills.includes('sql') || matchedSkills.includes('tableau')) {
    recommendedActions.push('Spotlight Tableau interactive dashboard portfolio and SQL data extraction from Red Ventures');
  }
  if (isEnglishPost) {
    recommendedActions.push('Send cover letter in English with link to portfolio https://lisa.bleuh.fr/');
  } else {
    recommendedActions.push('Mention professional written French comprehension while highlighting native English / international campaign capability');
  }

  if (matchedSkills.length < 3) {
    gaps.push('Job highlights specialized platforms (e.g. Google Ads SEA) that can be augmented with Lisa\'s strong Facebook/TikTok Paid Social foundation');
  }

  return {
    overall: roundedOverall,
    tier,
    breakdown: {
      alternanceFit: Math.round(contractScore * 10) / 10,
      englishEnvironment: Math.round(languageScore * 10) / 10,
      techAndPaidMedia: Math.round(techSkillsScore * 10) / 10,
      locationAndCommute: Math.round(locationScore * 10) / 10,
      learningPotential: Math.round(learningScore * 10) / 10
    },
    strengths: strengths.length > 0 ? strengths : ['Good foundational marketing overlap'],
    gaps: gaps.length > 0 ? gaps : ['Minor platform-specific nuances easily bridged on the job'],
    recommendedActions
  };
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
