<template>
  <main>
    <h2 class="subtitle">Elenco voci</h2>
    <hr/>

    <div class="columns is-vcentered">

      <div class="field column">
        <label class="label">Persona</label>
        <div class="control">
          <div class="select is-fullwidth"  :class="{'is-warning': !isPersonValid}">
            <select v-model="personName">
              <option v-for="person in people" :value="person.name" :key="person.id">
                {{ person.name }}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="field column">
        <label class="label">Anno</label>
        <div class="control">
          <div class="select is-fullwidth" :class="{'is-warning': !isYearValid}">
            <select v-model="fiscalYear">
              <option value=2023>2023 (modello 730 2024)</option>
              <option value=2024>2024 (modello 730 2025)</option>
              <option value=2025>2025 (modello 730 2026)</option>
              <option value=2026>2026 (modello 730 2027)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="column is-narrow" >
        <button class="button is-link is-outlined mr-1" title="Refresh"
          @click="fetchList" :disabled="!canFetch || loadingFetch">⭮</button>
          <button class="button is-info is-outlined mr-1" title="Salva giustificativi"
          @click="saveArchivesClicked" :disabled="!hasAnyEntry || downloadingArchives">
          <span v-if="hasAnyEntry">📦</span><span v-else>&nbsp;</span>
        </button>
        <button class="button is-info is-outlined" title="Download tabella"
          @click="downloadEntriesTable" :disabled="!hasAnyEntry">
          <span v-if="hasAnyEntry">💾</span><span v-else>&nbsp;</span>
        </button>
      </div>
    </div>

    <article class="message is-danger" v-if="lastRequestErrorMessage">
      <div class="message-header is-size-7">
        <p>Errore</p>
        <button class="delete" aria-label="delete" @click="lastRequestErrorMessage = null"></button>
      </div>
      <div class="message-body is-size-7">{{ lastRequestErrorMessage }}</div>
    </article>

    <section class="block" v-if="downloadingArchives">
      <span>⭮ Downloading ... </span>
      <span class="is-size-7">Scaricate {{ downloadArchivesEntryCount }}/{{ downloadArchivesEntryTotal }} voci, salvati {{ downloadArchivesCount }} files</span>
    </section>

    <p v-if="!canFetch">Seleziona filtri</p>

    <p v-else-if="!entriesList.length">Nessuna voce</p>

    <table class="table is-fullwidth" v-else>
      <thead>
        <tr>
          <th>#</th>
          <th>Data</th>
          <th>Importo</th>
          <th></th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in entriesList" :key="entry.id">
          <td :title="entry.id">#</td>
          <td>{{entry.date}}</td>
          <td>{{entry.importo}}</td>
          <td>
            <span v-if="downloadingOneRequest">⭮</span>
            <a v-else @click="downloadEntryContent(entry)" title="Download giustificativo">📃</a>
          </td>
          <td>
            <span v-if="sendingDeleteRequest">⭮</span>
            <a @click="deleteEntry(entry.id)" title="Download giustificativo">🗑️</a>
          </td>
          <td></td>
        </tr>
      </tbody>
    </table>

  </main>
</template>

<script>
// import readFile from '@/include/readFile.js'
import { requestToWorker } from '@/include/httpRequests.js'
import { useUsersStore } from '@/stores/users'

export default {
  name: 'ListView',

  components: {
  },

  data() {
    const usersStore = useUsersStore()

    return {
      usersStore,

      personName: null,
      fiscalYear: 2023,

      loadingFetch: false,
      entriesList: [],

      sendingDeleteRequest: false,
      downloadingOneRequest: false,
      downloadingArchives: false,
      downloadArchivesEntryCount: null,
      downloadArchivesEntryTotal: null,
      downloadArchivesCount: null,
      lastRequestErrorMessage: null,

      downloadOneFileContent: null,
    }
  },

  computed: {

    people() {
      return this.usersStore.getPeople
    },

    isPersonValid({personName}) {
      return (personName != null)
    },

    isYearValid({fiscalYear}) {
      return fiscalYear && (fiscalYear >= 2023) && (fiscalYear <= 2030)
    },

    canFetch({ isPersonValid, isYearValid}) {
      return (isPersonValid && isYearValid)
    },

    query({canFetch, personName, fiscalYear}) {
      if (!canFetch) return
      return new URLSearchParams({
        person: personName,
        year: fiscalYear,
      })
    },

    hasAnyEntry({ canFetch, entriesList}) {
      if (!canFetch) return false
      return entriesList.length
    },

  },

  methods: {

    async downloadPlain(content, filename, option) {
      let blob  = new Blob( [content, ], option, )
      let link  = document.createElement('a')

      link.href     = window.URL.createObjectURL(blob)
      link.download = filename.replace(/\s/g, '')

      document.body.appendChild(link)

      link.click()
      link.remove()
    },

    fetchList() {
      if (this.loadingFetch) return

      this.loadingFetch = true
      this.entriesList = []

      requestToWorker({
        method: 'GET',
        path: `/entries/${this.personName}/${this.fiscalYear}`,
        auth: this.usersStore.authorizationHeader,
      })
      .then(async (response) => {
        const body = await response.json()
        if (body.error) throw body
        this.entriesList = body.data
      })
      .catch((err) => {
        this.lastRequestErrorMessage = err.message
      })
      .then(() => {
        this.loadingFetch = false
      })
    },

    downloadEntriesTable() {
      let { fiscalYear, personName } = this
      let length = this.entriesList.length

      let header = [
        '#',
        'Data',
        'Importo',
        'Nome File Giustificativo',
      ].join(';')

      let csv = this.entriesList.reduce( (csv, e, index) => {
        let row = [
          e.id,
          e.date,
          e.importo,
          e.contentFileName,
        ].map(v => String(v))

        return index < length
          ? csv + row.join(';') + '\n'
          : csv + row.join(';')
      }, header + '\n')

      let filename  = `voci730_${fiscalYear}_${personName}.csv`

      this.downloadPlain(csv, filename, {type: 'text/csv'})
    },

    async downloadArchives() {
      const path = `/entries/${this.personName}/${this.fiscalYear}/download`
      const defaultFileNameSuffix = `archive${this.fiscalYear}_${this.personName}_`
      const authHeader = this.usersStore.authorizationHeader

      this.downloadArchivesCount = 0
      this.downloadArchivesEntryCount = 0
      this.downloadArchivesEntryTotal = this.entriesList.length

      let downloadComplete = false
      let saveFilePromise = null

      while (!downloadComplete) {
        let response = await requestToWorker({
            method: 'GET',
            path: `${path}?first=${this.downloadArchivesEntryCount}`,
            auth: authHeader,
          })
          .then(async response => {
            if (response.status === 204) {
              downloadComplete = true
              return
            }
            if (response.status !== 200) {
              const body = await response.json()
              if (body.error) throw body
              else throw {message: 'Unkwown Error'}
            }
            return response
          })
          .catch((err) => {
            this.lastRequestErrorMessage = err.message
            return
          })

        if (!response) break

        const content = await response.arrayBuffer()

        let fileName = `archive${defaultFileNameSuffix}_from${this.downloadArchivesEntryCount}.zip`
        const contentDisposition = response.headers.get('Content-Disposition')
        if (contentDisposition && contentDisposition.includes('filename=')) {
          const matches = contentDisposition.match(/filename="(.+?)"/)
          if (matches && matches[1]) fileName = matches[1]
        }

        const downloadFromHeader = parseInt(response.headers.get('X-Download-From')) || 0
        const downloadToHeader = parseInt(response.headers.get('X-Download-To')) || 0
        const downloadMaxHeader = parseInt(response.headers.get('X-Download-Max')) || 0

        if (downloadToHeader == downloadMaxHeader) {downloadComplete = true}
        if (this.downloadArchivesEntryCount == downloadToHeader) {
          throw new Error('No download progress')
        }
        if (downloadFromHeader != this.downloadArchivesEntryCount) {
          throw new Error(`X-Download-From: ${downloadFromHeader} != ${this.downloadArchivesEntryCount}`)
        }
        this.downloadArchivesEntryCount = downloadToHeader
        this.downloadArchivesEntryTotal = downloadMaxHeader

        if (saveFilePromise) await saveFilePromise
        saveFilePromise = this.downloadPlain(content, fileName, {type: 'application/zip'})
          .then(() => {this.downloadArchivesCount += 1})

        if (this.downloadArchivesEntryCount >= this.downloadArchivesEntryTotal) {
          downloadComplete = true
          break
        }
      }

      if (saveFilePromise) await saveFilePromise
    },

    saveArchivesClicked() {
      this.downloadingArchives = true

      this.downloadArchives()
        .catch((err) => {
          console.error('Error during archive download:', err)
        })
        .then(() => {
          setTimeout(() => {this.downloadingArchives = false}, 1000)
        })

    },

    downloadEntryContent(entry) {
      if (this.downloadingOneRequest) return
      const entryId = entry.id

      this.downloadingOneRequest = true
      this.lastRequestErrorMessage = null

      requestToWorker({
        method: 'GET',
        path: `/entries/${this.personName}/${this.fiscalYear}/download/${entryId}`,
        auth: this.usersStore.authorizationHeader,
      })
      .then(async (response) => {
        if (response.status !== 200) {
          const body = await response.json()
          if (body.error) throw body
          else throw {message: 'Unkwown Error'}
        }
        const content = await response.arrayBuffer()
        this.downloadPlain(content, entry.contentFileName, {type: entry.contentFileType})
      })
      .catch((err) => {
        this.lastRequestErrorMessage = err.message
      })
      .then(() => {
        this.downloadingOneRequest = false
      })
    },

    deleteEntry(entryId) {
      if (this.sendingDeleteRequest) return

      this.sendingDeleteRequest = true
      this.lastRequestErrorMessage = null

      requestToWorker({
        method: 'DELETE',
        path: `/entry`,
        auth: this.usersStore.authorizationHeader,
        payload: {
          id: entryId,
          year: this.fiscalYear,
          user: this.personName,
        },
      })
      .then(async (response) => {
        const body = await response.json()
        if (body.error) throw body
      })
      .catch((err) => {
        this.lastRequestErrorMessage = err.message
      })
      .then(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        this.sendingDeleteRequest = false
        this.fetchList()
      })
    },

  },

  watch: {
    query() {
      if (this.query) this.fetchList()
    }
  }

}

</script>