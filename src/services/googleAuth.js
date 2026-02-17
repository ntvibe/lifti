import { DRIVE_SCOPE, GOOGLE_CLIENT_ID } from '../config/google'

let tokenClient
let cachedAccessToken = null
let gisLoadingPromise

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve()
  }

  if (gisLoadingPromise) {
    return gisLoadingPromise
  }

  gisLoadingPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-google-identity="true"]')

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleIdentity = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services.'))
    document.head.appendChild(script)
  })

  return gisLoadingPromise
}

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

export async function signIn() {
  await loadGoogleIdentityScript()

  const client = getTokenClient()

  return new Promise((resolve, reject) => {
    client.callback = (response) => {
      if (response.error || !response.access_token) {
        reject(new Error(response.error || 'Google sign-in did not return an access token.'))
        return
      }

      cachedAccessToken = response.access_token
      resolve(response.access_token)
    }

    client.requestAccessToken({ prompt: 'consent' })
  })
}

export function signOut() {
  cachedAccessToken = null
}

export function getCachedAccessToken() {
  return cachedAccessToken
}
