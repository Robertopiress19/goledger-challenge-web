import { httpClient } from './httpClient'

export async function getSchema(assetType) {
  if (!assetType) {
    const response = await httpClient.get('/query/getSchema')
    return response.data
  }

  const response = await httpClient.post('/query/getSchema', { assetType })
  return response.data
}

export async function searchAssets(assetType, selectorExtras = {}, options = {}) {
  const { limit, bookmark } = options

  const selector = {
    '@assetType': assetType,
    ...selectorExtras,
  }

  const queryPayload = {
    selector,
  }

  if (typeof limit === 'number' && limit > 0) {
    queryPayload.limit = limit
  }

  if (typeof bookmark === 'string') {
    queryPayload.bookmark = bookmark
  }

  const response = await httpClient.post('/query/search', {
    query: queryPayload,
  })

  return response.data
}

export async function createAsset(assetType, payload) {
  const response = await httpClient.post('/invoke/createAsset', {
    asset: [
      {
        '@assetType': assetType,
        ...payload,
      },
    ],
  })

  return response.data
}

export async function updateAsset(assetType, payload) {
  const response = await httpClient.put('/invoke/updateAsset', {
    update: {
      '@assetType': assetType,
      ...payload,
    },
  })

  return response.data
}

export async function deleteAsset(assetType, key) {
  const response = await httpClient.delete('/invoke/deleteAsset', {
    data: {
      key: {
        '@assetType': assetType,
        ...key,
      },
    },
  })

  return response.data
}
