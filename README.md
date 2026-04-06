# GoLedger Challenge Web App

Aplicacao React para o desafio GoLedger com foco em arquitetura limpa, UX moderna e operacoes completas de CRUD para os ativos:

- tvShows
- seasons
- episodes
- watchlist (favoritos)

## Stack

- React 19 + Vite
- React Query para cache e sincronizacao de dados
- Axios para cliente HTTP
- React Hook Form + Zod para formularios e validacao

## Arquitetura

Estrutura principal:

- src/api: cliente HTTP e chamadas dos endpoints da API blockchain
- src/core: configuracoes e utilitarios compartilhados
- src/features/assets: regras da feature de ativos e hooks de dominio
- src/components: componentes reaproveitaveis de interface

Principios aplicados:

- separacao clara entre camada de dados, regras e apresentacao
- mutacoes e cache centralizados no React Query
- formulários desacoplados com validacao robusta
- configuracao por variavel de ambiente para credenciais e chaves primarias

## Configuracao de ambiente

1. Copie o arquivo de exemplo:

	PowerShell: Copy-Item .env.example .env

Ja deixei um arquivo .env criado no projeto com os valores padrao. Falta apenas preencher usuario e senha.

2. Preencha no arquivo .env:

- VITE_API_USER
- VITE_API_PASSWORD
- opcional: VITE_PRIMARY_KEYS_JSON para inferencia de chave por tipo de ativo

Exemplo:

VITE_PRIMARY_KEYS_JSON={"tvShows":["id"],"seasons":["id","tvShowId"],"episodes":["id","seasonId"],"watchlist":["id","userId"]}

## Rodando o projeto

1. Instalar dependencias:

	npm install

2. Rodar em desenvolvimento:

	npm run dev

3. Build de producao:

	npm run build

4. Preview local:

	npm run preview

## Checklist de validacao rapida

1. Validar acesso da API com credenciais:

	npm run check:api

2. Iniciar frontend:

	npm run dev

3. Testar fluxo na tela:

- Search: aplicar filtro {} e verificar listagem
- Create: criar um ativo com campos do schema
- Update: editar um item pela acao Editar
- Delete: remover pela acao Remover

4. Validar qualidade tecnica:

	npm run lint
	npm run build

## Endpoints utilizados

Base da API:

- http://ec2-50-19-36-138.compute-1.amazonaws.com/api

Operacoes implementadas:

- POST /query/search
- POST /query/getSchema
- POST /invoke/createAsset
- PUT /invoke/updateAsset
- DELETE /invoke/deleteAsset

## Entrega do desafio com fork

Fluxo recomendado:

1. Faça fork de https://github.com/goledgerdev/goledger-challenge-web na sua conta GitHub.
2. Clone o fork para sua maquina.
3. Copie o conteudo desta aplicacao para dentro do repositorio forkado.
4. Commit e push no seu fork.
5. Envie o link do seu fork para avaliacao.

Comandos git exemplo:

git init
git add .
git commit -m "feat: implementa dashboard CRUD blockchain para catalogo de tv"
git branch -M main
git remote add origin URL_DO_SEU_FORK
git push -u origin main

Se nao conseguir forkar, crie repositorio privado e conceda acesso aos usuarios solicitados no enunciado.
