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
          <div class="select is-fullwidth"  :class="{'is-warning': !isYearValid}">
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
          @click="saveTable" :disabled="!hasAnyEntry">🖫</button>
        <button class="button is-info is-outlined" title="Download"
          @click="downloadFile" :disabled="!hasAnyEntry">⇩</button>
      </div>
    </div>

    <p v-for="entry in entriesList">{{ entry.id }} / {{ entry.importo }} / {{ entry.date }}</p>

  </main>
</template>

<script>
// import readFile from '@/include/readFile.js'
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

      fileContent: null,
      fileError: null,
      filename: null,
      uploading: false,
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

    hasAnyEntry() {
      return false
    },

  },

  methods: {
    fetchList() {
      if (this.loadingFetch) return
      let token = this.usersStore.getToken

      this.loadingFetch = true
      this.entriesList = []

      fetch(`${import.meta.env.VITE_API_URL}/entries?${this.query}`, {
        method: "GET",
        headers: {
          "Authorization": token,
        }
      })
      .then(async (response) => {
        const body = await response.json()
        if (body.error) throw body
        this.entriesList = body.data
      })
      .catch((err) => {
        console.log(err.message)
      })
      .then(() => {
        this.loadingFetch = false
      })
    },

    downloadFile() {
      // ...
    },

    saveTable() {
      // ..
    },
  },

  watch: {
    query() {
      if (this.query) this.fetchList()
    }
  }

}

</script>