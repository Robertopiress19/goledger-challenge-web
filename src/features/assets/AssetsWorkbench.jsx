import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  appConfig,
  clearApiCredentials,
  hasApiCredentials,
  setApiCredentials,
} from '../../core/config'
import { searchAssets } from '../../api/assetsApi'
import { extractKeyFromAsset, prettyJson } from '../../core/keyUtils'
import { getApiErrorMessage } from '../../api/httpClient'
import { ASSET_TYPES } from './assetTypes'
import { useAssetMutations, useAssetPagedSearch, useAssetSchema } from './useAssets'

const templatesByType = {
  tvShows: {
    title: 'Breaking Bad',
    description: 'Um professor de quimica entra no submundo do crime para sustentar a familia.',
    recommendedAge: 16,
  },
  seasons: {
    id: 'season-001',
    tvShowId: 'show-001',
    seasonNumber: 1,
    title: 'Season 1',
  },
  episodes: {
    id: 'episode-001',
    seasonId: 'season-001',
    episodeNumber: 1,
    title: 'Pilot',
  },
  watchlist: {
    id: 'watch-001',
    userId: 'user-001',
    tvShowId: 'show-001',
  },
}

const fallbackSearchFieldByType = {
  tvShows: 'title',
  seasons: 'tvShowId',
  episodes: 'seasonId',
  watchlist: 'userId',
}

function toFieldRowsFromObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [{ key: '', value: '' }]
  }

  const entries = Object.entries(value)
  if (entries.length === 0) {
    return [{ key: '', value: '' }]
  }

  return entries.map(([key, itemValue]) => ({
    key,
    value:
      typeof itemValue === 'object' && itemValue !== null
        ? JSON.stringify(itemValue)
        : String(itemValue ?? ''),
  }))
}

function parseFieldValue(value) {
  const normalized = value.trim()

  if (normalized === 'true') {
    return true
  }

  if (normalized === 'false') {
    return false
  }

  if (normalized !== '' && !Number.isNaN(Number(normalized))) {
    return Number(normalized)
  }

  if (
    (normalized.startsWith('{') && normalized.endsWith('}')) ||
    (normalized.startsWith('[') && normalized.endsWith(']'))
  ) {
    try {
      return JSON.parse(normalized)
    } catch {
      return normalized
    }
  }

  return normalized
}

function toObjectFromRows(rows) {
  return rows.reduce((accumulator, row) => {
    const key = row.key.trim()
    if (!key) {
      return accumulator
    }

    accumulator[key] = parseFieldValue(row.value)
    return accumulator
  }, {})
}

function getDisplayTitle(asset) {
  return (
    asset.title ||
    asset.name ||
    asset.tvShowTitle ||
    asset.id ||
    asset.__ledgerKey ||
    'Item sem titulo'
  )
}

function getSummaryLine(assetType, asset) {
  if (assetType === 'tvShows') {
    return `${asset.genre ?? 'Genero nao informado'} • ${asset.year ?? '-'}`
  }

  if (assetType === 'seasons') {
    return `Serie ${asset.tvShowId ?? '-'} • Temporada ${asset.seasonNumber ?? '-'}`
  }

  if (assetType === 'episodes') {
    return `Temporada ${asset.seasonId ?? '-'} • Episodio ${asset.episodeNumber ?? '-'}`
  }

  return `Usuario ${asset.userId ?? '-'} • Favorito ${asset.tvShowId ?? asset.episodeId ?? '-'}`
}

function validateRequiredFields(requiredFields, payload) {
  const missing = requiredFields.filter((field) => {
    const value = payload[field]
    return value === undefined || value === null || String(value).trim() === ''
  })

  return {
    isValid: missing.length === 0,
    missing,
  }
}

function getSchemaFieldMetadata(schemaData) {
  const props = Array.isArray(schemaData?.props) ? schemaData.props : []
  const allowedFields = props
    .map((property) => property?.tag)
    .filter((fieldName) => typeof fieldName === 'string' && fieldName.trim() !== '')
  const requiredFields = props
    .filter((property) => property?.required)
    .map((property) => property?.tag)
    .filter((fieldName) => typeof fieldName === 'string' && fieldName.trim() !== '')

  return {
    allowedFields,
    requiredFields,
  }
}

function sanitizePayloadBySchema(payload, allowedFields) {
  if (allowedFields.length === 0) {
    return payload
  }

  return Object.entries(payload).reduce((accumulator, [key, value]) => {
    if (allowedFields.includes(key)) {
      accumulator[key] = value
    }

    return accumulator
  }, {})
}

function extractPosterQuery(assetType, asset) {
  if (!asset || typeof asset !== 'object') {
    return ''
  }

  if (assetType === 'tvShows') {
    return String(asset.title || asset.name || '').trim()
  }

  if (assetType === 'seasons' || assetType === 'episodes') {
    return String(asset.tvShowTitle || asset.showTitle || '').trim()
  }

  return String(asset.tvShowTitle || asset.title || '').trim()
}

export function AssetsWorkbench() {
  const queryClient = useQueryClient()
  const [activeAssetType, setActiveAssetType] = useState(ASSET_TYPES[0].id)
  const [apiUserInput, setApiUserInput] = useState(appConfig.apiUser)
  const [apiPasswordInput, setApiPasswordInput] = useState(appConfig.apiPassword)
  const [authVersion, setAuthVersion] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [searchFieldInput, setSearchFieldInput] = useState(fallbackSearchFieldByType[ASSET_TYPES[0].id])
  const [searchValueInput, setSearchValueInput] = useState('')
  const [selectorExtras, setSelectorExtras] = useState({})
  const [filterHistoryByType, setFilterHistoryByType] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const [bookmarkByPage, setBookmarkByPage] = useState({ 1: '' })
  const pageSize = 12
  const [modalMode, setModalMode] = useState(null)
  const [editingAsset, setEditingAsset] = useState(null)
  const [formRows, setFormRows] = useState(toFieldRowsFromObject(templatesByType[ASSET_TYPES[0].id]))
  const [missingFields, setMissingFields] = useState([])
  const [posterMap, setPosterMap] = useState({})
  const [feedback, setFeedback] = useState('')
  const credentialsReady = hasApiCredentials()

  const schemaQuery = useAssetSchema(activeAssetType, {
    enabled: credentialsReady,
    authVersion,
  })
  const currentBookmark = bookmarkByPage[currentPage] ?? ''

  const assetsQuery = useAssetPagedSearch(activeAssetType, selectorExtras, {
    enabled: credentialsReady,
    authVersion,
    pageSize,
    bookmarkToken: currentBookmark,
  })
  const { createMutation, updateMutation, deleteMutation } = useAssetMutations(activeAssetType)
  const schemaMetadata = getSchemaFieldMetadata(schemaQuery.data)

  const pagePayload = assetsQuery.data ?? { items: [], bookmark: '' }
  const assetItems = pagePayload.items
  const nextBookmarkToken = pagePayload.bookmark
  const hasPreviousPage = currentPage > 1
  const hasNextPage = Boolean(bookmarkByPage[currentPage + 1] || nextBookmarkToken)

  useEffect(() => {
    let cancelled = false

    const loadRealPosters = async () => {
      const queries = Array.from(
        new Set(
          assetItems
            .map((asset) => extractPosterQuery(activeAssetType, asset))
            .filter((value) => value.length > 2),
        ),
      )
        .filter((query) => !posterMap[query])
        .slice(0, 12)

      if (queries.length === 0) {
        return
      }

      const updates = {}

      await Promise.all(
        queries.map(async (query) => {
          try {
            const response = await fetch(
              `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(query)}`,
            )

            if (!response.ok) {
              return
            }

            const data = await response.json()
            const image = data?.image?.original || data?.image?.medium || ''

            if (image) {
              updates[query] = image
            }
          } catch {
            // Silent fail keeps UX fast when the external image API does not respond.
          }
        }),
      )

      if (!cancelled && Object.keys(updates).length > 0) {
        setPosterMap((previous) => ({ ...previous, ...updates }))
      }
    }

    void loadRealPosters()

    return () => {
      cancelled = true
    }
  }, [activeAssetType, assetItems, posterMap])

  useEffect(() => {
    if (!credentialsReady || !nextBookmarkToken || bookmarkByPage[currentPage + 1]) {
      return
    }

    const nextQueryKey = [
      'assets-paged',
      activeAssetType,
      selectorExtras,
      pageSize,
      nextBookmarkToken,
      authVersion,
    ]

    void queryClient.prefetchQuery({
      queryKey: nextQueryKey,
      queryFn: async () => {
        const data = await searchAssets(activeAssetType, selectorExtras, {
          limit: pageSize,
          bookmark: nextBookmarkToken,
        })

        return {
          items: Array.isArray(data?.result) ? data.result : Array.isArray(data) ? data : [],
          bookmark:
            typeof data?.metadata?.bookmark === 'string'
              ? data.metadata.bookmark
              : typeof data?.bookmark === 'string'
                ? data.bookmark
                : '',
        }
      },
    })
  }, [
    activeAssetType,
    authVersion,
    bookmarkByPage,
    credentialsReady,
    currentPage,
    nextBookmarkToken,
    pageSize,
    queryClient,
    selectorExtras,
  ])

  const goToPreviousPage = () => {
    if (!hasPreviousPage) {
      return
    }

    setCurrentPage((previous) => Math.max(1, previous - 1))
  }

  const goToNextPage = () => {
    const knownBookmark = bookmarkByPage[currentPage + 1]

    if (knownBookmark !== undefined) {
      setCurrentPage((previous) => previous + 1)
      return
    }

    if (!nextBookmarkToken) {
      return
    }

    setBookmarkByPage((previous) => ({
      ...previous,
      [currentPage + 1]: nextBookmarkToken,
    }))
    setCurrentPage((previous) => previous + 1)
  }

  const modalTitle =
    modalMode === 'create'
      ? `Novo ${activeAssetType}`
      : modalMode === 'edit'
        ? `Editar ${activeAssetType}`
        : `Remover ${activeAssetType}`

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  const clearFeedback = () => setFeedback('')

  const openCreate = () => {
    setModalMode('create')
    setEditingAsset(null)
    setMissingFields([])

    const template = templatesByType[activeAssetType] ?? {}
    const filteredTemplate = sanitizePayloadBySchema(template, schemaMetadata.allowedFields)

    setFormRows(toFieldRowsFromObject(filteredTemplate))
  }

  const openEdit = (asset) => {
    setModalMode('edit')
    setEditingAsset(asset)
    setMissingFields([])

    const source = { ...asset }
    delete source.__ledgerKey
    delete source['@assetType']

    setFormRows(toFieldRowsFromObject(source))
  }

  const openDelete = (asset) => {
    setModalMode('delete')
    setEditingAsset(asset)
    setMissingFields([])

    const key = extractKeyFromAsset(asset, activeAssetType, appConfig.primaryKeysByAssetType) ?? {
      id: asset.id ?? '',
    }
    setFormRows(toFieldRowsFromObject(key))
  }

  const closeModal = () => {
    setModalMode(null)
    setEditingAsset(null)
    setMissingFields([])
  }

  const runCreate = async (payload) => {
    clearFeedback()

    if (!credentialsReady) {
      setFeedback('Credenciais ausentes: configure VITE_API_USER e VITE_API_PASSWORD no arquivo .env.')
      return
    }

    const sanitizedPayload = sanitizePayloadBySchema(payload, schemaMetadata.allowedFields)

    const validation = validateRequiredFields(schemaMetadata.requiredFields, sanitizedPayload)
    if (!validation.isValid) {
      setMissingFields(validation.missing)
      setFeedback(`Campos obrigatorios ausentes: ${validation.missing.join(', ')}`)
      return
    }

    try {
      await createMutation.mutateAsync(sanitizedPayload)
      setMissingFields([])
      setFeedback('Ativo criado com sucesso.')
      closeModal()
    } catch (error) {
      setFeedback(`Falha ao criar: ${getApiErrorMessage(error)}`)
    }
  }

  const runUpdate = async (payload) => {
    clearFeedback()

    if (!credentialsReady) {
      setFeedback('Credenciais ausentes: configure VITE_API_USER e VITE_API_PASSWORD no arquivo .env.')
      return
    }

    const sanitizedPayload = sanitizePayloadBySchema(payload, schemaMetadata.allowedFields)

    try {
      await updateMutation.mutateAsync(sanitizedPayload)
      setMissingFields([])
      setFeedback('Ativo atualizado com sucesso.')
      closeModal()
    } catch (error) {
      setFeedback(`Falha ao atualizar: ${getApiErrorMessage(error)}`)
    }
  }

  const runDelete = async (payload) => {
    clearFeedback()

    if (!credentialsReady) {
      setFeedback('Credenciais ausentes: configure VITE_API_USER e VITE_API_PASSWORD no arquivo .env.')
      return
    }

    try {
      await deleteMutation.mutateAsync(payload)
      setFeedback('Ativo removido com sucesso.')
      closeModal()
    } catch (error) {
      setFeedback(`Falha ao remover: ${getApiErrorMessage(error)}`)
    }
  }

  const submitModal = async () => {
    setMissingFields([])
    const payload = toObjectFromRows(formRows)

    if (Object.keys(payload).length === 0) {
      setFeedback('Preencha ao menos um campo antes de enviar.')
      return
    }

    if (modalMode === 'create') {
      await runCreate(payload)
    } else if (modalMode === 'edit') {
      await runUpdate(payload)
    } else if (modalMode === 'delete') {
      await runDelete(payload)
    }
  }

  const addRow = () => {
    setFormRows((previous) => [...previous, { key: '', value: '' }])
  }

  const updateRow = (index, nextRow) => {
    setFormRows((previous) => previous.map((row, rowIndex) => (rowIndex === index ? nextRow : row)))
  }

  const removeRow = (index) => {
    setFormRows((previous) => previous.filter((_, rowIndex) => rowIndex !== index))
  }

  const applySearchFilter = () => {
    const field = searchFieldInput.trim()
    const rawValue = searchValueInput.trim()

    if (!field || !rawValue) {
      setSelectorExtras({})
      setCurrentPage(1)
      setBookmarkByPage({ 1: '' })
      setFilterHistoryByType((previous) => ({
        ...previous,
        [activeAssetType]: [],
      }))
      setFeedback('Filtro limpo. Listando todos os registros do tipo selecionado.')
      return
    }

    setSelectorExtras({ [field]: parseFieldValue(rawValue) })
    setCurrentPage(1)
    setBookmarkByPage({ 1: '' })
    setFilterHistoryByType((previous) => {
      const current = previous[activeAssetType] ?? []
      const entry = {
        field,
        value: rawValue,
      }
      const deduplicated = current.filter(
        (item) => !(item.field === entry.field && item.value === entry.value),
      )

      return {
        ...previous,
        [activeAssetType]: [entry, ...deduplicated].slice(0, 6),
      }
    })
    setFeedback(`Filtro aplicado em ${field}.`)
  }

  const handleChangeAssetType = (assetType) => {
    setActiveAssetType(assetType)
    setSearchFieldInput(fallbackSearchFieldByType[assetType] ?? 'id')
    setSearchValueInput('')
    setSelectorExtras({})
    setCurrentPage(1)
    setBookmarkByPage({ 1: '' })
    setFormRows(toFieldRowsFromObject(templatesByType[assetType] ?? {}))
    closeModal()
    setFeedback('')
  }

  const handleSaveCredentials = () => {
    const normalizedUser = apiUserInput.trim()
    const normalizedPassword = apiPasswordInput.trim()

    if (!normalizedUser || !normalizedPassword) {
      setFeedback('Preencha usuario e senha para autenticar na API.')
      return
    }

    setApiCredentials(normalizedUser, normalizedPassword)
    setAuthVersion((prev) => prev + 1)
    setCurrentPage(1)
    setBookmarkByPage({ 1: '' })
    setFeedback('Credenciais aplicadas. Recarregando dados...')
  }

  const handleClearCredentials = () => {
    clearApiCredentials()
    setApiUserInput('')
    setApiPasswordInput('')
    setAuthVersion((prev) => prev + 1)
    setCurrentPage(1)
    setBookmarkByPage({ 1: '' })
    setFeedback('Credenciais removidas.')
  }

  const getPosterCandidate = (asset) => {
    if (!asset || typeof asset !== 'object') {
      return ''
    }

    return (
      asset.posterUrl ||
      asset.poster ||
      asset.image ||
      asset.imageUrl ||
      asset.cover ||
      asset.coverUrl ||
      ''
    )
  }

  const getAutoPoster = (assetType, asset, index) => {
    const base = `${assetType}-${asset?.id ?? asset?.title ?? asset?.__ledgerKey ?? index}`
    return `https://picsum.photos/seed/${encodeURIComponent(base)}/420/620`
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <span className="badge">Desafio GoLedger</span>
          <h1>TV Ledger IMDb</h1>
          <p>
            Catalogo de series, temporadas, episodios e favoritos com foco em usabilidade, visual limpo
            e operacoes CRUD na blockchain.
          </p>
        </div>
        <div className="hero-card">
          <h2>Status da integracao</h2>
          <div className="status-chips">
            <span className={credentialsReady ? 'chip ok' : 'chip warn'}>
              {credentialsReady ? 'API autenticada' : 'Credenciais pendentes'}
            </span>
            <span className="chip">Colecao: {activeAssetType}</span>
          </div>
          <p className="hint">Conexao segura com autenticacao basica.</p>
          <button type="button" onClick={() => setShowSettings((prev) => !prev)}>
            {showSettings ? 'Ocultar configuracoes' : 'Configurar credenciais'}
          </button>

          {showSettings ? (
            <div className="credentials-form">
              <label>
                Usuario
                <input
                  type="text"
                  value={apiUserInput}
                  onChange={(event) => setApiUserInput(event.target.value)}
                  placeholder="usuario"
                />
              </label>
              <label>
                Senha
                <input
                  type="password"
                  value={apiPasswordInput}
                  onChange={(event) => setApiPasswordInput(event.target.value)}
                  placeholder="senha"
                />
              </label>
              <div className="credentials-actions">
                <button type="button" onClick={handleSaveCredentials}>
                  Salvar credenciais
                </button>
                <button type="button" className="danger" onClick={handleClearCredentials}>
                  Limpar
                </button>
              </div>
              <p className="hint">As credenciais ficam salvas localmente no navegador.</p>
            </div>
          ) : null}
        </div>
      </header>

      <main className="content-grid">
        <section className="left-column">
          <div className="panel">
            <h3>Tipos de ativo</h3>
            <p>Selecione o dominio que deseja administrar.</p>
            <div className="type-list">
              {ASSET_TYPES.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => handleChangeAssetType(asset.id)}
                  className={asset.id === activeAssetType ? 'active' : ''}
                >
                  <span>{asset.title}</span>
                  <small>{asset.subtitle}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title-row">
              <h3>Search</h3>
              <button type="button" onClick={applySearchFilter} disabled={assetsQuery.isFetching}>
                Aplicar
              </button>
            </div>
            <p>Pesquisa por campo para o tipo de ativo selecionado.</p>
            <div className="search-grid">
              <label>
                Campo
                <input
                  value={searchFieldInput}
                  onChange={(event) => setSearchFieldInput(event.target.value)}
                  placeholder="title"
                />
              </label>
              <label>
                Valor
                <input
                  value={searchValueInput}
                  onChange={(event) => setSearchValueInput(event.target.value)}
                  placeholder="Breaking Bad"
                />
              </label>
            </div>

            {(filterHistoryByType[activeAssetType] ?? []).length > 0 ? (
              <div className="filter-history">
                {(filterHistoryByType[activeAssetType] ?? []).map((item) => (
                  <button
                    key={`${item.field}-${item.value}`}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setSearchFieldInput(item.field)
                      setSearchValueInput(item.value)
                      setSelectorExtras({ [item.field]: parseFieldValue(item.value) })
                      setCurrentPage(1)
                      setBookmarkByPage({ 1: '' })
                    }}
                  >
                    {item.field}: {item.value}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="panel compact">
            <h3>Schema ({activeAssetType})</h3>
            <p>
              {!credentialsReady
                ? 'Informe credenciais para consultar schema.'
                : schemaQuery.isLoading
                ? 'Carregando schema...'
                : schemaQuery.isError
                  ? 'Falha ao carregar schema.'
                  : 'Schema recebido da API.'}
            </p>
            <pre>{prettyJson(credentialsReady ? (schemaQuery.data ?? {}) : {})}</pre>
          </div>

          <button type="button" className="create-main" onClick={openCreate}>
            + Novo registro
          </button>
        </section>

        <section className="right-column">
          {feedback ? <div className="feedback">{feedback}</div> : null}

          {!credentialsReady ? (
            <div className="panel compact">
              <h3>Busca desabilitada</h3>
              <p>Informe credenciais para carregar dados dos ativos.</p>
            </div>
          ) : assetsQuery.isError ? (
            <div className="panel compact error-box">
              <h3>Erro de busca</h3>
              <p>{getApiErrorMessage(assetsQuery.error)}</p>
            </div>
          ) : assetsQuery.isLoading ? (
            <div className="panel compact">
              <h3>Carregando catalogo...</h3>
            </div>
          ) : assetItems.length === 0 ? (
            <div className="panel compact">
              <h3>Nenhum registro encontrado</h3>
              <p>
                {hasPreviousPage
                  ? 'Esta pagina nao possui itens. Volte para a pagina anterior.'
                  : 'Crie o primeiro item para esta colecao.'}
              </p>
              {hasPreviousPage ? (
                <button type="button" onClick={goToPreviousPage}>
                  Voltar uma pagina
                </button>
              ) : null}
            </div>
          ) : (
            <div className="cards-grid">
              {assetItems.map((asset, index) => (
                <article className="media-card" key={`${activeAssetType}-${asset.id ?? asset.__ledgerKey ?? index}`}>
                  <div className="poster-wrap">
                    <div className="poster">{String(getDisplayTitle(asset)).slice(0, 1).toUpperCase()}</div>
                    <img
                      className="poster-image"
                      src={
                        posterMap[extractPosterQuery(activeAssetType, asset)] ||
                        getPosterCandidate(asset) ||
                        getAutoPoster(activeAssetType, asset, index)
                      }
                      alt={getDisplayTitle(asset)}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                    <span className="poster-type">{activeAssetType}</span>
                  </div>
                  <div className="media-content">
                    <h3>{getDisplayTitle(asset)}</h3>
                    <p>{getSummaryLine(activeAssetType, asset)}</p>
                    <small>ID: {asset.id ?? asset.__ledgerKey ?? '-'}</small>
                  </div>
                  <div className="media-actions">
                    <button type="button" onClick={() => openEdit(asset)}>
                      Editar
                    </button>
                    <button type="button" className="danger" onClick={() => openDelete(asset)}>
                      Remover
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {credentialsReady ? (
            <div className="pagination-bar panel compact">
              <button
                type="button"
                onClick={goToPreviousPage}
                disabled={!hasPreviousPage || assetsQuery.isFetching}
              >
                {assetsQuery.isFetching ? 'Carregando...' : 'Anterior'}
              </button>
              <span>
                Pagina {currentPage} • {assetItems.length} itens carregados
              </span>
              <button
                type="button"
                onClick={goToNextPage}
                disabled={!hasNextPage || assetsQuery.isFetching}
              >
                {assetsQuery.isFetching ? 'Carregando...' : 'Proxima'}
              </button>
            </div>
          ) : null}
        </section>
      </main>

      {modalMode ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="panel-title-row">
              <h3>{modalTitle}</h3>
              <button type="button" onClick={closeModal}>
                Fechar
              </button>
            </div>
            {editingAsset ? (
              <p className="hint">Item selecionado: {getDisplayTitle(editingAsset)}</p>
            ) : null}
            {missingFields.length > 0 ? (
              <p className="modal-error-hint">
                Campos obrigatorios faltando: {missingFields.join(', ')}
              </p>
            ) : null}
            <div className="rows-stack">
              {formRows.map((row, index) => (
                <div className="field-row" key={`${index}-${row.key}`}>
                  <input
                    className={missingFields.includes(row.key.trim()) ? 'field-missing' : ''}
                    value={row.key}
                    onChange={(event) =>
                      updateRow(index, {
                        ...row,
                        key: event.target.value,
                      })
                    }
                    placeholder="campo"
                  />
                  <input
                    className={missingFields.includes(row.key.trim()) ? 'field-missing' : ''}
                    value={row.value}
                    onChange={(event) =>
                      updateRow(index, {
                        ...row,
                        value: event.target.value,
                      })
                    }
                    placeholder="valor"
                  />
                  <button
                    type="button"
                    className="danger"
                    onClick={() => removeRow(index)}
                    disabled={formRows.length === 1}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button type="button" onClick={addRow}>
                + Campo
              </button>
              <button type="button" onClick={submitModal} disabled={isMutating}>
                {isMutating ? 'Enviando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
