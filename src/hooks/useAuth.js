import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  loginWithPopupTokenFlow,
  revokeAccessToken,
  fetchGoogleProfile,
  hydrateGoogleIdentity,
  isTokenExpired,
  readStoredAuth,
  storeAuth,
  clearStoredAuth,
} from '../services/googleAuth'

export default function useAuth() {
  const stored = useMemo(() => readStoredAuth(), [])
  const [accessToken, setAccessToken] = useState(stored.accessToken)
  const [tokenExpiry, setTokenExpiry] = useState(stored.expiresAt)
  const [profileName, setProfileName] = useState(stored.profile?.name || '')
  const [profilePicture, setProfilePicture] = useState(stored.profile?.picture || '')
  const [authStatus, setAuthStatus] = useState('initializing')

  const clearAuthState = useCallback(() => {
    clearStoredAuth()
    setAccessToken('')
    setTokenExpiry(0)
    setProfileName('')
    setProfilePicture('')
    setAuthStatus('signed_out')
  }, [])

  useEffect(() => {
    if (stored.accessToken && !isTokenExpired(stored.expiresAt)) {
      setAuthStatus('signed_in')
      return
    }

    clearAuthState()
  }, [clearAuthState, stored.accessToken, stored.expiresAt])

  useEffect(() => {
    hydrateGoogleIdentity().catch(() => {})
  }, [])

  const login = useCallback(async () => {
    const tokenPayload = await loginWithPopupTokenFlow()
    const profile = await fetchGoogleProfile(tokenPayload.access_token).catch(() => null)
    const expiresAt = storeAuth({
      accessToken: tokenPayload.access_token,
      expiresIn: tokenPayload.expires_in,
      profile,
    })

    setAccessToken(tokenPayload.access_token)
    setTokenExpiry(expiresAt)
    setProfileName(profile?.name || '')
    setProfilePicture(profile?.picture || '')
    setAuthStatus('signed_in')
    return tokenPayload.access_token
  }, [])

  const logout = useCallback(() => {
    revokeAccessToken(accessToken)
    clearAuthState()
  }, [accessToken, clearAuthState])

  return {
    accessToken,
    tokenExpiry,
    profileName,
    profilePicture,
    authStatus,
    isAuthenticated: authStatus === 'signed_in' && Boolean(accessToken) && !isTokenExpired(tokenExpiry),
    authLoading: authStatus === 'initializing',
    login,
    logout,
    clearAuthState,
  }
}
