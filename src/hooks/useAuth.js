import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  requestAccessToken,
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
  const [accessToken, setAccessToken] = useState(stored.token)
  const [tokenExpiry, setTokenExpiry] = useState(stored.expiry)
  const [profileName, setProfileName] = useState(stored.profileName)
  const [profilePicture, setProfilePicture] = useState(stored.profilePicture)
  const [loading, setLoading] = useState(true)

  const applyAuth = useCallback((tokenPayload, profile = null) => {
    const expiresIn = Number(tokenPayload.expires_in) || 3600
    const expiry = Date.now() + expiresIn * 1000
    const name = profile?.name || profileName || ''
    const picture = profile?.picture || profilePicture || ''

    setAccessToken(tokenPayload.access_token)
    setTokenExpiry(expiry)
    setProfileName(name)
    setProfilePicture(picture)
    storeAuth({ token: tokenPayload.access_token, expiry, profileName: name, profilePicture: picture })
  }, [profileName, profilePicture])

  useEffect(() => {
    let mounted = true

    const boot = async () => {
      try {
        await hydrateGoogleIdentity()

        if (stored.token && !isTokenExpired(stored.expiry)) {
          if (mounted) {
            setAccessToken(stored.token)
            setTokenExpiry(stored.expiry)
            setLoading(false)
          }
          return
        }

        const silentToken = await requestAccessToken('')
        if (!mounted || !silentToken?.access_token) {
          return
        }

        const profile = await fetchGoogleProfile(silentToken.access_token).catch(() => null)
        applyAuth(silentToken, profile)
      } catch {
        clearStoredAuth()
        if (mounted) {
          setAccessToken('')
          setTokenExpiry(0)
          setProfileName('')
          setProfilePicture('')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    boot()

    return () => {
      mounted = false
    }
  }, [applyAuth, stored.expiry, stored.token])

  const login = useCallback(async () => {
    const tokenPayload = await requestAccessToken('consent')
    const profile = await fetchGoogleProfile(tokenPayload.access_token).catch(() => null)
    applyAuth(tokenPayload, profile)
  }, [applyAuth])

  const logout = useCallback(() => {
    revokeAccessToken(accessToken)
    clearStoredAuth()
    setAccessToken('')
    setTokenExpiry(0)
    setProfileName('')
    setProfilePicture('')
  }, [accessToken])

  return {
    accessToken,
    tokenExpiry,
    profileName,
    profilePicture,
    isAuthenticated: Boolean(accessToken) && !isTokenExpired(tokenExpiry),
    authLoading: loading,
    login,
    logout,
  }
}
