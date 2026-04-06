import axios from 'axios'
import { appConfig, toBasicAuthHeader } from '../core/config'

export const httpClient = axios.create({
  baseURL: appConfig.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

httpClient.interceptors.request.use((config) => {
  const authHeader = toBasicAuthHeader()

  if (authHeader) {
    config.headers.Authorization = authHeader
  }

  return config
})

export function getApiErrorMessage(error) {
  const apiMessage = error?.response?.data?.error
  const genericMessage = error?.response?.statusText

  if (typeof apiMessage === 'string' && apiMessage.trim()) {
    return apiMessage
  }

  if (typeof genericMessage === 'string' && genericMessage.trim()) {
    return genericMessage
  }

  return error?.message || 'Falha ao comunicar com a API'
}
