import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAsset,
  deleteAsset,
  getSchema,
  searchAssets,
  updateAsset,
} from '../../api/assetsApi'

function normalizeSearchResult(data) {
  const toAssetObject = (item) => {
    if (item && typeof item === 'object' && item.Record && typeof item.Record === 'object') {
      return {
        ...item.Record,
        __ledgerKey: item.Key,
      }
    }

    return item
  }

  if (Array.isArray(data)) {
    return data.map(toAssetObject)
  }

  if (Array.isArray(data?.result)) {
    return data.result.map(toAssetObject)
  }

  if (Array.isArray(data?.data)) {
    return data.data.map(toAssetObject)
  }

  return []
}

function normalizeSearchPayload(data) {
  const items = normalizeSearchResult(data)
  const bookmark =
    typeof data?.metadata?.bookmark === 'string'
      ? data.metadata.bookmark
      : typeof data?.bookmark === 'string'
        ? data.bookmark
        : ''

  return {
    items,
    bookmark,
  }
}

export function useAssetSchema(assetType, options = {}) {
  const { enabled = true, authVersion = 0 } = options

  return useQuery({
    queryKey: ['schema', assetType, authVersion],
    queryFn: () => getSchema(assetType),
    enabled: Boolean(assetType) && enabled,
    staleTime: 1000 * 60 * 5,
  })
}

export function useAssetSearch(assetType, selectorExtras, options = {}) {
  const { enabled = true, authVersion = 0 } = options

  return useQuery({
    queryKey: ['assets', assetType, selectorExtras, authVersion],
    queryFn: async () => {
      const data = await searchAssets(assetType, selectorExtras)
      return normalizeSearchResult(data)
    },
    enabled: Boolean(assetType) && enabled,
  })
}

export function useAssetPagedSearch(assetType, selectorExtras, options = {}) {
  const {
    enabled = true,
    authVersion = 0,
    pageSize = 12,
    bookmarkToken = '',
  } = options

  return useQuery({
    queryKey: ['assets-paged', assetType, selectorExtras, pageSize, bookmarkToken, authVersion],
    queryFn: async () => {
      const data = await searchAssets(assetType, selectorExtras, {
        limit: pageSize,
        bookmark: bookmarkToken,
      })

      return normalizeSearchPayload(data)
    },
    enabled: Boolean(assetType) && enabled,
    keepPreviousData: true,
  })
}

export function useAssetMutations(assetType) {
  const queryClient = useQueryClient()

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['assets', assetType] })
    await queryClient.invalidateQueries({ queryKey: ['assets-paged', assetType] })
  }

  const createMutation = useMutation({
    mutationFn: (payload) => createAsset(assetType, payload),
    onSuccess: refresh,
  })

  const updateMutation = useMutation({
    mutationFn: (payload) => updateAsset(assetType, payload),
    onSuccess: refresh,
  })

  const deleteMutation = useMutation({
    mutationFn: (key) => deleteAsset(assetType, key),
    onSuccess: refresh,
  })

  return {
    createMutation,
    updateMutation,
    deleteMutation,
  }
}
