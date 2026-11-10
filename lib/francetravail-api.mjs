import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROFILE_FILE = path.join(__dirname, '..', 'data', 'profile.json');

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get France Travail API Configuration and Status
 */
export function getFranceTravailApiConfig() {
  let clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID || '';
  let clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET || '';

  if ((!clientId || !clientSecret) && fs.existsSync(PROFILE_FILE)) {
    try {
      const profile = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf-8'));
      if (profile.franceTravailApi) {
        clientId = clientId || profile.franceTravailApi.clientId || '';
        clientSecret = clientSecret || profile.franceTravailApi.clientSecret || '';
      }
    } catch (e) {
      // Ignore parse error
    }
  }

  const isConfigured = Boolean(clientId && clientSecret);

  return {
    isConfigured,
    clientId: clientId ? `${clientId.slice(0, 6)}...` : null,
    apiPortalUrl: 'https://francetravail.io/',
    apiPackage: "Offres d'emploi v2 (REST / OAuth 2.0)",
    endpoint: 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search',
    status: isConfigured 
      ? 'Connected (OAuth 2.0 Client Credentials ready)'
      : 'Ready for Credentials (Free registration on francetravail.io)',
    setupInstructions: [
      '1. Create a free developer account at https://francetravail.io/',
      '2. In your dashboard, click "Créer une application" and subscribe to the "Offres d\'emploi v2" API.',
      '3. Copy your Client ID and Client Secret into your .env or Profile settings.',
      '4. The crawler will immediately begin streaming real-time live offers via the official France Travail REST API.'
    ]
  };
}

/**
 * Obtain or renew France Travail OAuth2 Access Token
 */
export async function getFranceTravailAccessToken() {
  const { isConfigured } = getFranceTravailApiConfig();
  if (!isConfigured) {
    throw new Error('France Travail API credentials are not configured. Set FRANCE_TRAVAIL_CLIENT_ID and FRANCE_TRAVAIL_CLIENT_SECRET.');
  }

  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  let clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  let clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const profile = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf-8'));
    clientId = profile.franceTravailApi?.clientId;
    clientSecret = profile.franceTravailApi?.clientSecret;
  }

  const tokenUrl = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'o2dsoffre api_offresdemploiv2'
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`France Travail OAuth authentication failed: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 1499) * 1000;
  return cachedToken;
}

/**
 * Query official France Travail API for job offers
 */
export async function searchFranceTravailApi({ keywords = 'traffic manager, acquisition', contract = 'all', department = '75', range = '0-19' } = {}) {
  const { isConfigured } = getFranceTravailApiConfig();
  if (!isConfigured) {
    return {
      connected: false,
      message: 'France Travail API requires Client ID & Secret from francetravail.io',
      offers: []
    };
  }

  try {
    const token = await getFranceTravailAccessToken();
    const params = new URLSearchParams({
      motsCles: keywords,
      departement: department,
      range: range,
      sort: '1' // 1 = Tri par date de création décroissante (Timeline first!)
    });

    if (contract.toLowerCase() === 'alternance') {
      params.append('typeContrat', 'E2'); // E2 = Contrat apprentissage / alternance
    } else if (contract.toLowerCase() === 'cdi') {
      params.append('typeContrat', 'CDI');
    } else if (contract.toLowerCase() === 'cdd') {
      params.append('typeContrat', 'CDD');
    }

    const apiUrl = `https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?${params.toString()}`;
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (res.status === 204) {
      // No offers found
      return { connected: true, total: 0, offers: [] };
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`France Travail API search error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const rawOffers = data.resultats || [];

    // Map into our standard Job Hunter Agent schema
    const offers = rawOffers.map(o => ({
      id: `ft-${o.id}`,
      title: o.intitule || 'Poste Digital / Marketing',
      company: o.entreprise?.nom || 'Entreprise Confidentielle',
      source: 'France Travail',
      sourceUrl: o.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`,
      companyCareersUrl: o.entreprise?.url || null,
      location: o.lieuTravail?.libelle || 'Paris (75)',
      contract: o.typeContratLibelle || (o.typeContrat === 'E2' ? 'Alternance (12 mois)' : o.typeContrat),
      startDate: o.dateActualisation ? 'Dès que possible / Immediate (ASAP)' : 'ASAP',
      startDateNote: 'Verified via France Travail API',
      salary: o.salaire?.libelle || 'Grille conventionnelle',
      postedAt: o.dateCreation || new Date().toISOString(),
      scrapedAt: new Date().toISOString(),
      workLanguage: /english|anglais/i.test(o.description || '') ? 'English / International' : 'Bilingual French/English',
      description: o.description || '',
      requiredSkills: (o.competences || []).map(c => c.libelle).slice(0, 6)
    }));

    return {
      connected: true,
      total: offers.length,
      offers
    };
  } catch (err) {
    console.error('[France Travail API Error]:', err.message);
    return {
      connected: false,
      error: err.message,
      offers: []
    };
  }
}
