import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '..', 'data', 'profile.json');

export function getProfile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading profile:', err);
  }
  return {
    name: 'Lisa Liu',
    headline: 'Senior Digital Project Manager & Product Owner',
    email: 'lisa.liu.pro@gmail.com',
    location: 'Paris, France',
    targetRoles: ['Chef de Projet Digital', 'Product Owner'],
    skills: ['Agile', 'Scrum', 'Jira', 'E-Commerce', 'GA4']
  };
}

export function updateProfile(updated) {
  try {
    const current = getProfile();
    const merged = { ...current, ...updated };
    fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    return { success: true, profile: merged };
  } catch (err) {
    console.error('Error updating profile:', err);
    return { success: false, error: err.message };
  }
}
