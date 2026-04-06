import axios from 'axios'

const apiBaseUrl = process.env.VITE_API_BASE_URL || 'http://ec2-50-19-36-138.compute-1.amazonaws.com/api'
const apiUser = process.env.VITE_API_USER
const apiPassword = process.env.VITE_API_PASSWORD

if (!apiUser || !apiPassword) {
  console.error('Erro: defina VITE_API_USER e VITE_API_PASSWORD no .env antes de validar a API.')
  process.exit(1)
}

const normalizedBaseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl
const authorization = `Basic ${Buffer.from(`${apiUser}:${apiPassword}`).toString('base64')}`

async function run() {
  try {
    const schemaList = await axios.get(`${normalizedBaseUrl}/query/getSchema`, {
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
      },
      timeout: 10000,
    })

    const availableAssets = Array.isArray(schemaList.data)
      ? schemaList.data
      : Array.isArray(schemaList.data?.result)
        ? schemaList.data.result
        : []

    console.log('Conexao com API: OK')
    console.log(`Base URL: ${normalizedBaseUrl}`)
    console.log(`Ativos retornados: ${availableAssets.length}`)

    if (availableAssets.length > 0) {
      console.log('Tipos de ativos detectados:')
      availableAssets.forEach((asset, index) => {
        const name = typeof asset === 'string' ? asset : JSON.stringify(asset)
        console.log(`${index + 1}. ${name}`)
      })
    }
  } catch (error) {
    const status = error?.response?.status
    const details = error?.response?.data || error.message

    console.error('Falha ao validar API.')
    if (status) {
      console.error(`HTTP ${status}`)
    }
    console.error(typeof details === 'string' ? details : JSON.stringify(details, null, 2))
    process.exit(1)
  }
}

run()
