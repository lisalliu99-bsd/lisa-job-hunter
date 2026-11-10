import { getProfile } from './profile.mjs';

/**
 * CV Suggestions & ATS Optimization Engine for Lisa Liu
 * Tailored for 12-Month Alternance (INSEEC Paris M2, Oct 2026)
 * Focusing on Paid Media ($1.3M+ budgets), Tableau, and International Teams.
 */
export function getCvSuggestions(job) {
  const profile = getProfile();
  const jobText = `${job.title} ${job.description} ${(job.requiredSkills || []).join(' ')}`.toLowerCase();
  
  const targetKeywords = (job.requiredSkills || []).concat([
    'paid social', 'meta ads', 'tiktok ads', 'snapchat', 'sql', 'tableau',
    'ga4', 'gtm', 'cpa', 'roi', 'a/b testing', 'e-commerce', 'funnel', 'cro'
  ]);

  const profileText = `${profile.summary} ${(profile.skills || []).join(' ')} ${(profile.experienceBullets || []).join(' ')}`.toLowerCase();

  const missingKeywords = targetKeywords.filter(kw => {
    return jobText.includes(kw.toLowerCase()) && !profileText.includes(kw.toLowerCase());
  });

  const uniqueMissing = [...new Set(missingKeywords)];

  const suggestions = [
    {
      type: 'English Working Environment Fit',
      title: 'International Positioning',
      description: `State **Native English & Chinese fluency** prominently in your header to instantly signal your comfort in English-speaking scaleups.`
    },
    {
      type: 'Alternance Rhythm Transparency',
      title: 'School/Work Schedule',
      description: `Highlight your **Thursday & Friday company availability** (3 days school Mon-Wed at INSEEC Paris) to reassure hiring managers immediately.`
    },
    {
      type: 'Quantified Ad Budget Scale',
      title: 'Budget & ROI Credibility',
      description: `For **${job.company}**, lead with your **$1.3M+/month ad spend** and **$300k Snapchat partner test with 35+ optimization sprints**.`
    }
  ];

  const tailoredBullet = `Directed high-scale Paid Social acquisition campaigns ($1.3M+/month) on Meta, TikTok, and Snapchat, conducting 35+ structured A/B optimization cycles to reduce CPA, while deploying interactive Tableau and SQL dashboards to guide executive growth decisions. Available 2 days/week (Thu-Fri) for 12-month alternance.`;

  return {
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    atsMatchScore: Math.min(99, Math.max(85, Math.round((job.grade?.overall || 9.2) * 10))),
    missingKeywords: uniqueMissing.slice(0, 5),
    suggestions,
    recommendedBullet: tailoredBullet,
    candidateBullets: profile.experienceBullets || []
  };
}
