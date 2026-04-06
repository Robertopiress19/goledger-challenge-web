import { extractKeyFromAsset, prettyJson } from '../core/keyUtils'

export function AssetsTable({
  items,
  assetType,
  primaryKeysByAssetType,
  onUseInUpdate,
  onUseInDelete,
  onQuickDelete,
  isDeleting,
}) {
  const columns = Array.from(
    new Set(items.flatMap((item) => Object.keys(item || {}))),
  ).slice(0, 6)

  if (items.length === 0) {
    return (
      <div className="panel compact">
        <h3>Resultados</h3>
        <p>Nenhum registro encontrado para este tipo de ativo.</p>
      </div>
    )
  }

  return (
    <div className="panel table-panel">
      <div className="panel-title-row">
        <h3>Resultados ({items.length})</h3>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const inferredKey = extractKeyFromAsset(
                item,
                assetType,
                primaryKeysByAssetType,
              )

              return (
                <tr key={`${assetType}-${index}`}>
                  {columns.map((column) => (
                    <td key={`${index}-${column}`}>
                      <span className="cell-text">
                        {typeof item[column] === 'object'
                          ? prettyJson(item[column])
                          : String(item[column] ?? '-')}
                      </span>
                    </td>
                  ))}
                  <td>
                    <div className="row-actions">
                      <button type="button" onClick={() => onUseInUpdate(item)}>
                        Editar
                      </button>
                      <button type="button" onClick={() => onUseInDelete(inferredKey)}>
                        Chave
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => onQuickDelete(inferredKey)}
                        disabled={isDeleting || !inferredKey}
                        title={
                          inferredKey
                            ? 'Remover usando chave inferida'
                            : 'Defina VITE_PRIMARY_KEYS_JSON para inferencia precisa'
                        }
                      >
                        {isDeleting ? '...' : 'Remover'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
