import { DRIVE_SCOPE, GOOGLE_CLIENT_ID } from '../config/google'
import { loadGis } from '../lib/loadGis'

export const GIS_LOAD_ERROR_MESSAGE = 'Google Sign-in unavailable.'
const AUTH_STORAGE_KEY = 'lifti_auth'
const EXPIRY_SAFETY_MS = 60_000

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
      ux_mode: 'popup',
      callback: () => {},
    })
  }

  return tokenClient
}

export function isTokenExpired(expiresAt) {
  return !expiresAt || Number(expiresAt) <= Date.now() + EXPIRY_SAFETY_MS
}

export function readStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) {
      return { accessToken: '', expiresAt: 0, profile: null }
    }

    const parsed = JSON.parse(raw)
    return {
      accessToken: parsed.access_token || '',
      expiresAt: Number(parsed.expires_at) || 0,
      profile: parsed.profile || null,
    }
  } catch {
    return { accessToken: '', expiresAt: 0, profile: null }
  }
}

export function storeAuth({ accessToken, expiresIn, profile }) {
  const expiresAt = Date.now() + (Number(expiresIn) || 3600) * 1000 - EXPIRY_SAFETY_MS
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      access_token: accessToken,
      expires_at: expiresAt,
      profile: {
        name: profile?.name || '',
        picture: profile?.picture || '',
        email: profile?.email || '',
      },
    }),
  )

  return expiresAt
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

export async function hydrateGoogleIdentity() {
  try {
    await loadGis()
  } catch {
    throw new Error(GIS_LOAD_ERROR_MESSAGE)
  }
}

export async function requestAccessToken(prompt = '') {
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

export async function loginWithPopupTokenFlow() {
  try {
    return await requestAccessToken('')
  } catch {
    return requestAccessToken('consent')
  }
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
