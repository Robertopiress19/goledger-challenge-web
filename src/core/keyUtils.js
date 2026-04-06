const fallbackKeyCandidates = [
  'id',
  'tvShowTitle',
  'seasonNumber',
  'episodeNumber',
  'tvShowId',
  'seasonId',
  'episodeId',
  'favoriteId',
  'userId',
  'email',
  'uuid',
  '_id',
]

export function extractKeyFromAsset(asset, assetType, primaryKeysByAssetType = {}) {
  const source = asset?.Record && typeof asset.Record === 'object' ? asset.Record : asset

  const explicitKeys = primaryKeysByAssetType[assetType]

  if (Array.isArray(explicitKeys) && explicitKeys.length > 0) {
    const result = {}

    explicitKeys.forEach((keyName) => {
      if (source[keyName] !== undefined && source[keyName] !== null && source[keyName] !== '') {
        result[keyName] = source[keyName]
      }
    })

    return Object.keys(result).length > 0 ? result : null
  }

  const inferred = {}

  fallbackKeyCandidates.forEach((keyName) => {
    if (source[keyName] !== undefined && source[keyName] !== null && source[keyName] !== '') {
      inferred[keyName] = source[keyName]
    }
  })

  return Object.keys(inferred).length > 0 ? inferred : null
}

export function safelyParseJson(value) {
  try {
    return { data: JSON.parse(value), error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'JSON invalido' }
  }
}

export function prettyJson(value) {
  return JSON.stringify(value, null, 2)
}
