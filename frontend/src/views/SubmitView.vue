<template>
  <main>
    <h2 class="subtitle">Nuova Voce</h2>
    <hr/>

    <div class="field">
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

    <div class="field">
      <label class="label">Anno</label>
      <div class="control">
        <div class="select is-fullwidth"  :class="{'is-warning': !isYearValid}">
          <select v-model="entryYear">
            <option value=2023>2023 (modello 730 2024)</option>
            <option value=2024>2024 (modello 730 2025)</option>
            <option value=2025>2025 (modello 730 2026)</option>
            <option value=2026>2026 (modello 730 2027)</option>
          </select>
        </div>
      </div>
    </div>

    <div class="field">
      <label class="label">Importo</label>
      <div class="control">
        <input class="input" type="number" v-model="entryImporto" step="0.01" placeholder="Importo" :class="{'is-warning': !isImportoValid}">
      </div>
    </div>

    <div class="field">
      <label class="label">Data</label>
      <div class="field-body">
        <div class="field has-addons">
          <div class="control is-expanded">
            <input class="input" type="date" v-model="entryDate" step="0.01">
          </div>
          <div class="control">
            <button class="button" @click="setToday">Oggi</button>
          </div>
        </div>
      </div>
    </div>

    <div class="field">
      <label class="label">Giustificativo</label>
      <div class="field-body">

        <div class="file is-boxed is-fullwidth is-centered" :class="{'is-warning': !fileContent}">
          <label class="file-label">
            <input
              class="file-input"
              type="file"
              name="jpg"
              @change="fileChange"
              :class="{'is-loading': uploading}"
            >
            <span class="file-cta has-text-centered">
              <span class="file-icon">🗃️</span>
              <span class="file-label" v-if="isFilePresent">
                Cambia file…
              </span>
              <span class="file-label" v-else>
                Scegli un file…
              </span>
              <span class="file-label is-size-7" v-if="isFilePresent">
                <br>
                {{  filename }}
                <br>
                {{ fileDimension }}
              </span>
            </span>
          </label>
        </div>

      </div>
      <p class="help is-danger" v-if="fileError">{{ fileError }}</p>
    </div>

    <article class="message is-danger" v-if="uploadErrorMessage">
      <div class="message-header is-size-7">
        <p>Errore</p>
        <button class="delete" aria-label="delete" @click="uploadErrorMessage = null"></button>
      </div>
      <div class="message-body is-size-7">{{ uploadErrorMessage }}</div>
    </article>

    <article class="message is-success" v-if="uploadSucessMessage">
      <div class="message-header is-size-7">
        <p>{{ uploadSucessMessage }}</p>
        <button class="delete" aria-label="delete" @click="uploadSucessMessage = null"></button>
      </div>
      <div class="message-body is-size-7"><pre>{{ uploadedResult }}</pre></div>
    </article>

    <section class="columns">
      <section class="column">
        <button class="button is-info" :disabled="!canSave" @click="submitEntry" :class="{'is-loading': uploading}">
          Aggiungi
        </button>
      </section>
    </section>

  </main>
</template>

<script>
import { readBinaryFile } from '@/include/readFile.js'
import { useUsersStore } from '@/stores/users'

export default {
  name: 'SubmitView',

  components: {
  },

  data() {
    const usersStore = useUsersStore()

    return {
      usersStore,

      personName: null,
      entryImporto: 0,
      entryDate: null,
      entryYear: 2023,

      fileContent: null,
      fileError: null,
      filename: null,

      uploadSucessMessage: null,
      uploadErrorMessage: null,
      uploadedResult: null,
      uploading: false,
    }
  },

  mounted() {
    this.setToday()
  },

  computed: {

    people() {
      return this.usersStore.getPeople
    },

    isPersonValid({personName}) {
      return (personName != null)
    },

    isYearValid({entryYear}) {
      return entryYear && (entryYear >= 2023) && (entryYear <= 2030)
    },

    isImportoValid({entryImporto}) {
      return entryImporto && (entryImporto > 0)
    },

    isFilePresent({fileContent}) {
      return (fileContent && fileContent.length)
    },

    fileDimension({isFilePresent, fileContent}) {
      if (!isFilePresent) return
      let length = fileContent.length
      let formatter = new Intl.NumberFormat('it-IT', { maximumSignificantDigits: 3 })
      if (length < 10**3) return `${formatter.format(length)}B`
      if (length < 10**6) return `${formatter.format(length / 10**3)}KB`
      return `${formatter.format(length / 10**6)}MB`
    },

    canSave({ isPersonValid, isImportoValid, isYearValid, fileContent}) {
      return (isPersonValid && isImportoValid && isYearValid && isFilePresent)
    },

    b64EncodedFileContent({fileContent}) {
      if (!isFilePresent) return
      let b64Content
      try {
        const binString = Array.from(fileContent, (byte) => String.fromCodePoint(byte),).join("")
        b64Content = btoa(binString)
        console.log(new Date, 'b64content', b64Content.length)
        return b64Content
      } catch (e) {
        console.log(e)
        return
      }
    },

    postPayload({personName, entryDate, entryImporto, entryYear, b64EncodedFileContent}) {
      if (!this.canSave) return
      let formattedDate = entryDate
      return {
        user: personName,
        date: formattedDate,
        importo: entryImporto,
        year: entryYear,
        content: b64EncodedFileContent,
      }
    }

  },

  methods: {

    fileChange(event) {
      this.fileContent = null
      this.fileError = null
      this.filename = null

      const files = event.target.files
      if (!files || !files.length) return
      const file = files[0]
      if (!file) return

      this.filename = file.name
      this.uploading = true
      readBinaryFile(file)
        .then((fileContent) => {
          this.fileContent = new Uint8Array(fileContent)
        })
        .catch((e) => {
          this.errorMessage = 'Errore caricamento file'
          this.fileError = e
        })
        .then(() => {
          this.uploading = false
        })
    },

    setToday() {
      this.entryDate = (new Date).toISOString().split('T')[0]
    },

    submitEntry() {
      if (this.uploading) return
      if (!this.canSave) return

      this.uploading = true
      this.uploadSucessMessage = null
      this.uploadErrorMessage = null
      this.uploadedResult = null

      fetch(`${import.meta.env.VITE_API_URL}/entry`, {
        method: "POST",
        body: JSON.stringify(this.postPayload),
        headers: {
          "Authorization": this.usersStore.authorizationHeader,
        }
      })
      .then(async (response) => {
        const body = await response.json()
        if (body.error) throw body
        this.uploadedResult = body.data
        this.uploadSucessMessage = body.message
      })
      .catch((err) => {
        this.uploadErrorMessage = err.message
      })
      .then(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        this.uploading = false
      })

    }
  },

}
</script>

<style>

</style>
