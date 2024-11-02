<template>
  <div class="modal">
    <div class="modal-background"></div>
    <div class="modal-card">
      <section class="modal-card-body">
        Accesso & autorizzazione
        <hr />

        <article class="message is-danger" v-if="errorMessage">
          <div class="message-header is-size-7">
            <p>Errore</p>
            <button class="delete" aria-label="delete" @click="errorMessage = null"></button>
          </div>
          <div class="message-body is-size-7">
            {{ errorMessage }}
          </div>
        </article>

        <section v-if="isLoading" class="has-text-centered">
          <h1 class="title mb-3">⭮</h1>
          <h2 class="subtitle">Loading</h2>
          ...
        </section>

        <section v-else>
          <div class="field has-addons">
            <p class="control"><a class="button is-static">PIN</a></p>
            <p class="control is-expanded">
              <input class="input" type="text" placeholder="PIN" v-model="enteredPIN">
            </p>
            <p class="control"><a class="button" @click="clearPin">⌫</a></p>
          </div>
          <div class="fixed-grid has-3-cols">
            <div class="grid">
              <div class="cell is-col-span-2 is-row-start-4" @click="enterClicked">
                <button class="button is-fullwidth is-link">Invio</button>
              </div>
              <div class="cell" @click="numberClicked(1)"><button class="button is-fullwidth is-info">1</button></div>
              <div class="cell" @click="numberClicked(2)"><button class="button is-fullwidth is-info">2</button></div>
              <div class="cell" @click="numberClicked(3)"><button class="button is-fullwidth is-info">3</button></div>
              <div class="cell" @click="numberClicked(4)"><button class="button is-fullwidth is-info">4</button></div>
              <div class="cell" @click="numberClicked(5)"><button class="button is-fullwidth is-info">5</button></div>
              <div class="cell" @click="numberClicked(6)"><button class="button is-fullwidth is-info">6</button></div>
              <div class="cell" @click="numberClicked(7)"><button class="button is-fullwidth is-info">7</button></div>
              <div class="cell" @click="numberClicked(8)"><button class="button is-fullwidth is-info">8</button></div>
              <div class="cell" @click="numberClicked(9)"><button class="button is-fullwidth is-info">9</button></div>
              <div class="cell" @click="numberClicked(0)"><button class="button is-fullwidth is-info">0</button></div>
            </div>
          </div>

        </section>
      </section>
    </div>
  </div>
</template>

<script>
import { useUsersStore } from '@/stores/users'

export default {
  name: 'AuthAndInitModal',

  data() {
    let savedPin = localStorage.getItem('authToken')
    return {
      enteredPIN: savedPin || '',
      isLoading: false,
      errorMessage: null,
      apiUrl: import.meta.env.VITE_API_URL,
    }
  },

  computed: {
    token() {
      const usersStore = useUsersStore()
      return usersStore.getToken
    },
  },

  methods: {
    clearPin() {
      this.enteredPIN = ''
    },

    numberClicked(value) {
      this.enteredPIN += value
    },

    enterClicked(){
      this.isLoading = true
      this.responseMessage = null
      fetch(`${this.apiUrl}/people`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.enteredPIN}`,
        }
      })
      .then(async (response) => {
        const body = await response.json()
        if (body.error) throw body
        await new Promise(resolve => setTimeout(resolve, 100))
        let userList = body.data
        const authStore = useUsersStore()
        authStore.saveToken(this.enteredPIN)
        authStore.savePeople(userList)
      })
      .catch((err) => {
        this.errorMessage = err.message
      })
      .then(() => {
        this.isLoading = false
      })
    }
  },
}

</script>
