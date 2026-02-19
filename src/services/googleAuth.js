import { DRIVE_SCOPE, GOOGLE_CLIENT_ID } from '../config/google'
import { loadGis } from '../lib/loadGis'

export const GIS_LOAD_ERROR_MESSAGE = 'Failed to load Google Identity Services.'

const STORAGE_KEYS = {
  token: 'lifti_access_token',
  expiry: 'lifti_token_expiry',
  profileName: 'lifti_profile_name',
  profilePicture: 'lifti_profile_picture',
}

let tokenClient

function getTokenClient() {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is missing. Configure it before signing in.')
  }

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services is not available.')
  }

  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: `${DRIVE_SCOPE} openid profile email`,
      callback: () => {},
    })
  }

  return tokenClient
}

export function isTokenExpired(expiry) {
  return !expiry || Number(expiry) <= Date.now() + 30_000
}

export function readStoredAuth() {
  return {
    token: localStorage.getItem(STORAGE_KEYS.token) || '',
    expiry: Number(localStorage.getItem(STORAGE_KEYS.expiry) || 0),
    profileName: localStorage.getItem(STORAGE_KEYS.profileName) || '',
    profilePicture: localStorage.getItem(STORAGE_KEYS.profilePicture) || '',
  }
}

export function storeAuth({ token, expiry, profileName, profilePicture }) {
  localStorage.setItem(STORAGE_KEYS.token, token || '')
  localStorage.setItem(STORAGE_KEYS.expiry, String(expiry || 0))
  localStorage.setItem(STORAGE_KEYS.profileName, profileName || '')
  localStorage.setItem(STORAGE_KEYS.profilePicture, profilePicture || '')
}

export function clearStoredAuth() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
}

export async function hydrateGoogleIdentity() {
  try {
    await loadGis()
  } catch {
    throw new Error(GIS_LOAD_ERROR_MESSAGE)
  }
}

export async function requestAccessToken(prompt = 'consent') {
  try {
    await loadGis()
  } catch {
    throw new Error(GIS_LOAD_ERROR_MESSAGE)
  }

  const client = getTokenClient()

  return new Promise((resolve, reject) => {
    client.callback = (response) => {
      if (response.error || !response.access_token) {
        reject(new Error(response.error || 'Google sign-in did not return an access token.'))
        return
      }

      resolve(response)
    }

    client.requestAccessToken({ prompt })
  })
}

export async function fetchGoogleProfile(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error('Failed to load Google profile.')
  }

  return response.json()
}

export function revokeAccessToken(token) {
  if (!token || !window.google?.accounts?.oauth2?.revoke) {
    return
  }

  window.google.accounts.oauth2.revoke(token, () => {})
}
