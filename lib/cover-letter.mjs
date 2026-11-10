import { getProfile } from './profile.mjs';

/**
 * AI Cover Letter Generator for Lisa Liu
 * Tailored for 12-Month Alternance (Available Immediately / ASAP), INSEEC Paris,
 * 2 days/week company rhythm (Thursday & Friday),
 * and international / English-speaking tech & e-commerce teams.
 */
export function generateCoverLetter({ job, tone = 'modern', language = 'en' }) {
  const profile = getProfile();
  const company = job.company || 'the recruitment team';
  const title = job.title || 'Apprenticeship / Alternance';

  if (language === 'en') {
    return generateEnglishLetter(profile, job, company, title, tone);
  }
  return generateFrenchLetter(profile, job, company, title, tone);
}

function generateEnglishLetter(profile, job, company, title, tone) {
  const website = profile.website || 'https://lisa.bleuh.fr/';
  const contract = job.contract || 'Alternance (12 mois)';
  const isCDI = /cdi|permanent|temps plein/i.test(contract);
  const isCDD = /cdd|fixed-term/i.test(contract);
  const contractTypeLabel = isCDI ? 'CDI (Permanent)' : isCDD ? 'CDD (Fixed-Term)' : '12-Month Alternance';

  const availabilityClause = (isCDI || isCDD)
    ? `available immediately (as soon as possible) with full commitment to your scaling goals, bringing multi-million dollar ad budget steering ($1.3M+/mo) and Tableau BI analytics to ${company}.`
    : `available immediately (as soon as possible) with a school calendar of 3 days at university (Monday to Wednesday) and 2 full days dedicated to your team (Thursday & Friday).`;

  if (tone === 'executive') {
    return `Dear Hiring Team at ${company},\n\n` +
      `I am writing to express my enthusiastic interest in the **${title}** (${contractTypeLabel}) position. Currently completing my Master 2 (M2) in Digital Marketing & E-Commerce at **INSEEC Paris**, I am **${availabilityClause}\n\n` +
      `During my tenure as Paid Social Associate at **Red Ventures** (USA), I spearheaded full-funnel acquisition campaigns managing over $1.3M/month across Meta (Facebook Ads Manager, 900+ active ads), TikTok, Snapchat, Reddit, and X. Notably, I directed a $300K quarterly partner test on Snapchat, running 35+ optimization sprints and achieving a record-low CPA. Furthermore, I engineered interactive **Tableau executive dashboards** (tracking WoW and P3WA conversion metrics) that unified team reporting and directly influenced strategic scaling decisions.\n\n` +
      `Most recently, as Web Marketing Project Manager (Internship) at **South Pacific Management**, I leveraged D-EDGE Web Analytics to optimize direct hotel bookings, executed AI-driven SEO competitor benchmarking, and localized high-converting assets from French into US English.\n\n` +
      `As a native English and native Chinese speaker with professional written French comprehension, I thrive in international, fast-paced environments where English is the working language. I invite you to explore my interactive work samples and portfolio at **${website}**.\n\n` +
      `Available to start immediately, I would be delighted to discuss how my hands-on Paid Media expertise and data rigor can support ${company}'s growth goals.\n\n` +
      `Best regards,\n\n` +
      `**Lisa Liu**\n` +
      `M2 Digital Marketing & E-Commerce, INSEEC Paris\n` +
      `Saint-Maur-des-Fossés, Île-de-France\n` +
      `Portfolio: ${website} | Email: ${profile.email} | Tel: ${profile.phone}`;
  } else if (tone === 'cultural') {
    return `Hi ${company} Team,\n\n` +
      `I was thrilled to come across the **${title}** (${contractTypeLabel}) opportunity! As a digital marketer and data analyst passionate about international growth, I love ${company}'s forward-thinking approach and customer-centric culture.\n\n` +
      `I am currently completing my Master 2 in Digital Marketing & E-Commerce at **INSEEC Paris** and am **available to start immediately (ASAP)**. ${isCDI || isCDD ? 'I am excited to dedicate my full energy to scaling acquisition at ' + company + '.' : 'My school rhythm allows me to dedicate Thursdays and Fridays fully to ' + company + ', while remaining engaged with academic trends Mondays through Wednesdays.'}\n\n` +
      `Having managed over $1.3M/month in ad spend at **Red Ventures** across Facebook, TikTok, and Snapchat, and having built interactive **Tableau and SQL dashboards** to decode user behavior, I love testing creative angles, uncovering conversion bottlenecks, and collaborating with cross-functional teams.\n\n` +
      `Being native in English and Chinese, and actively developing my conversational French, I feel right at home in an international, multicultural team environment. You can check out some of my interactive projects and dashboard case studies on my personal portfolio: **${website}**.\n\n` +
      `I am ready to hit the ground running immediately and would love to chat with your team!\n\n` +
      `Warm regards,\n\n` +
      `**Lisa Liu**\n` +
      `lisalliu99@gmail.com | +33 06 72 55 84 59 | ${website}`;
  } else {
    // Default: Modern & Impact-Driven
    return `Dear Hiring Team at ${company},\n\n` +
      `I am writing to apply for the **${title}** (${contractTypeLabel}) position. Currently enrolled in the Master 2 (M2) Digital Marketing & E-Commerce program at **INSEEC Paris**, I am **available immediately (as soon as possible)** with zero date restrictions. I bring several years of proven hands-on experience managing multi-million dollar Paid Media budgets ($1.3M+/month), building interactive Tableau dashboards, and conducting advanced web analytics (SQL, GA4).\n\n` +
      `### Key Qualifications & Synergies:\n` +
      `• **Proven Paid Acquisition Scale**: Directed monthly ad budgets exceeding $1.3M at Red Ventures across Facebook Ads Manager (900+ active ads), TikTok, Snapchat, and Reddit. Executed a $300K Snapchat campaign test achieving a historic low CPA through 35+ systematic A/B optimization cycles.\n` +
      `• **Data Analytics & Dashboarding**: Designed and deployed executive Tableau dashboards tracking WoW and P3WA funnel metrics; proficient in SQL (DataGrip), Google Analytics (GA4), Google Tag Manager (GTM), and D-EDGE Web Analytics.\n` +
      `• **Web Marketing & Localization**: Led web strategy, AI search engine SEO benchmarking, and French-to-US English content localization at South Pacific Management.\n` +
      `• **Contract & Availability**: Available **immediately** for **${contractTypeLabel}**. Based in Saint-Maur-des-Fossés (RER A corridor) with full availability for hybrid or remote work.\n` +
      `• **International Background**: Native English and Chinese speaker with professional written French comprehension, ideal for international teams operating in English.\n\n` +
      `You can review my detailed projects and portfolio at: **${website}**.\n\n` +
      `I look forward to discussing how my analytical mindset and paid acquisition experience can contribute to ${company}'s upcoming milestones.\n\n` +
      `Sincerely,\n\n` +
      `**Lisa Liu**\n` +
      `INSEEC Paris — M2 Digital Marketing & E-Commerce\n` +
      `lisalliu99@gmail.com | +33 06 72 55 84 59 | Saint-Maur-des-Fossés, Île-de-France`;
  }
}

function generateFrenchLetter(profile, job, company, title, tone) {
  const website = profile.website || 'https://lisa.bleuh.fr/';
  const contract = job.contract || 'Alternance (12 mois)';
  const isCDI = /cdi|permanent|temps plein/i.test(contract);
  const isCDD = /cdd|fixed-term/i.test(contract);
  const contractLabel = isCDI ? 'CDI' : isCDD ? 'CDD' : 'alternance (12 mois)';

  return `Madame, Monsieur,\n\n` +
    `Actuellement étudiante en Master 2 (M2) Digital Marketing & E-Commerce à **l'INSEEC Paris**, c'est avec un grand enthousiasme que je vous présente ma candidature pour l'opportunité de **${title}** en **${contractLabel}** au sein de **${company}**. Je suis **disponible immédiatement (dès que possible)**.\n\n` +
    (isCDI || isCDD 
      ? `Résidant à Saint-Maur-des-Fossés (94, axe RER A), je suis immédiatement opérationnelle en formule sur site, hybride ou télétravail pour m'investir pleinement sur vos objectifs d'acquisition et d'optimisation du ROI.\n\n`
      : `Mon rythme de formation s'articule autour de **3 jours à l'école (Lundi, Mardi, Mercredi)** et **2 jours en entreprise (Jeudi & Vendredi)**. Résidant à Saint-Maur-des-Fossés (94, axe RER A), je suis disponible en formule hybride ou télétravail.\n\n`) +
    `Forte de plusieurs années d'expérience en marketing à la performance et analyse de données, j'ai notamment piloté chez **Red Ventures** des budgets d'acquisition Paid Social mensuels de plus de 1,3 million de dollars ($1.3M+) sur Facebook Ads Manager, TikTok, Snapchat et Reddit. J'y ai également conçu des **tableaux de bord interactifs sous Tableau et SQL** pour modéliser les performances du funnel de conversion et optimiser le CPA.\n\n` +
    `Plus récemment, en qualité de Web Marketing Project Manager chez **South Pacific Management**, j'ai exploité les données D-EDGE Web Analytics pour maximiser les réservations directes d'un groupe hôtelier et déployé des optimisations SEO ciblées sur les moteurs de recherche IA.\n\n` +
    `De langue maternelle anglaise et chinoise, avec une excellente compréhension écrite du français (oral conversationnel en cours de perfectionnement), je suis particulièrement motivée par les environnements multiculturels et internationaux où l'anglais est utilisé au quotidien. Vous pouvez consulter mon portfolio et mes réalisations sur : **${website}**.\n\n` +
    `Disponible immédiatement pour intégrer vos équipes, je serais ravie d'échanger avec vous afin de vous présenter de vive voix mes compétences et ma motivation.\n\n` +
    `Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.\n\n` +
    `**Lisa Liu**\n` +
    `M2 Digital Marketing & E-Commerce — INSEEC Paris\n` +
    `Saint-Maur-des-Fossés (94) | ${profile.email} | ${profile.phone}\n` +
    `Portfolio : ${website}`;
}
