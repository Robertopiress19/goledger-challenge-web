const FALLBACK_BASE_URL = 'http://ec2-50-19-36-138.compute-1.amazonaws.com/api'

function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') {
    return FALLBACK_BASE_URL
  }

  return url.endsWith('/') ? url.slice(0, -1) : url
}

function parsePrimaryKeyMap(value) {
  if (!value) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export const appConfig = {
  apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL),
  apiUser: import.meta.env.VITE_API_USER ?? '',
  apiPassword: import.meta.env.VITE_API_PASSWORD ?? '',
  primaryKeysByAssetType: parsePrimaryKeyMap(import.meta.env.VITE_PRIMARY_KEYS_JSON),
}

function hasWindowStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

if (hasWindowStorage()) {
  const storedUser = window.localStorage.getItem('goledger.apiUser')
  const storedPassword = window.localStorage.getItem('goledger.apiPassword')

  if (storedUser) {
    appConfig.apiUser = storedUser
  }

  if (storedPassword) {
    appConfig.apiPassword = storedPassword
  }
}

export function setApiCredentials(user, password) {
  appConfig.apiUser = user ?? ''
  appConfig.apiPassword = password ?? ''

  if (hasWindowStorage()) {
    window.localStorage.setItem('goledger.apiUser', appConfig.apiUser)
    window.localStorage.setItem('goledger.apiPassword', appConfig.apiPassword)
  }
}

export function clearApiCredentials() {
  appConfig.apiUser = ''
  appConfig.apiPassword = ''

  if (hasWindowStorage()) {
    window.localStorage.removeItem('goledger.apiUser')
    window.localStorage.removeItem('goledger.apiPassword')
  }
}

export function hasApiCredentials() {
  return Boolean(appConfig.apiUser && appConfig.apiPassword)
}

export function toBasicAuthHeader() {
  if (!hasApiCredentials()) {
    return null
  }

  return `Basic ${btoa(`${appConfig.apiUser}:${appConfig.apiPassword}`)}`
}
