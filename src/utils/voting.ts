// Client ID management using localStorage

import { v4 as uuidv4 } from 'uuid';

const CLIENT_ID_KEY = 'awards_voting_client_id';

export function getOrCreateClientId(): string {
  // Check if client ID already exists
  const existingId = localStorage.getItem(CLIENT_ID_KEY);
  if (existingId) {
    return existingId;
  }

  // Generate new UUID v4
  const newId = uuidv4();
  localStorage.setItem(CLIENT_ID_KEY, newId);
  return newId;
}

export function clearClientId(): void {
  localStorage.removeItem(CLIENT_ID_KEY);
}
