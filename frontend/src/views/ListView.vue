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
          <button class="button is-info is-outlined mr-1" title="Save"
          @click="saveTable" :disabled="!hasAnyEntry">
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
            <a v-else @click="downloadEntryContent(entry.id)" title="Download giustificativo">📃</a>
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

    downloadPlain(content, filename, option) {
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
      ].join(';')

      let csv = this.entriesList.reduce( (csv, e, index) => {
        let row = [
          e.id,
          e.date,
          e.importo,
        ].map(v => String(v))

        return index < length
          ? csv + row.join(';') + '\n'
          : csv + row.join(';')
      }, header + '\n')

      let filename  = `voci730_${fiscalYear}_${personName}.csv`

      this.downloadPlain(csv, filename, {type: 'text/csv'})
    },

    saveTable() {
      // ..
    },

    downloadEntryContent(entryId) {
      // ..
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