## Appunti730

Semplice mini applicazione per registrare spese del 730 in famiglia.

### Worker

Directory: `worker`

Deployed to cloudflare with project name: `appunti730-worker`

#### Setup

```sh
cd worker
npm install
```

#### Commands

* For Development
```sh
npx wrangler dev
```
* Deploy
```sh
npx wrangler deploy
```

### Front-end

Directory: `frontend`

Framework: [Vue.js](https://vuejs.org/)

Deployed to cloudflare with project name: `appunti730-frontend`

#### Setup

```sh
cd frontend
npm install
npx wrangler pages project create
```

#### Commands


* Compile and Hot-Reload for Development
```sh
npm run dev
```
* Compile and Minify for Production
```sh
npm run build
```
* Lint ([ESLint](https://eslint.org/))
```sh
npm run lint
```
* Customize configuration see [Vite Configuration Reference](https://vitejs.dev/config/).
* Deploy
```sh
npm deploy
```
