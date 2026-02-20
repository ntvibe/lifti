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
  const [loading, setLoading] = useState(true)

  const clearAuthState = useCallback(() => {
    clearStoredAuth()
    setAccessToken('')
    setTokenExpiry(0)
    setProfileName('')
    setProfilePicture('')
  }, [])

  useEffect(() => {
    if (stored.accessToken && !isTokenExpired(stored.expiresAt)) {
      setLoading(false)
      return
    }

    clearAuthState()
    setLoading(false)
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
    isAuthenticated: Boolean(accessToken) && !isTokenExpired(tokenExpiry),
    authLoading: loading,
    login,
    logout,
    clearAuthState,
  }
}
