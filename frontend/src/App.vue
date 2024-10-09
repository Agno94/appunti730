<!-- <script setup>
import { RouterLink, RouterView } from 'vue-router'
</script> -->

<template>
  <div class="columns">
    <div class="column is-3">
      <aside class="menu">
        <p class="menu-label">App Appunti 730</p>
        <ul class="menu-list">
          <li><RouterLink to="/submit">Nuova voce</RouterLink></li>
          <li><RouterLink to="/list">Elenco</RouterLink></li>
        </ul>
      </aside>
    </div>

    <div class="column is-9">
      <RouterView />
    </div>
  </div>

  <AuthAndInitModal :class="{'is-active': !isInitialize}"/>
</template>

<script>
import { RouterLink, RouterView } from 'vue-router'
import AuthAndInitModal from '@/components/AuthAndInitModal.vue'
import { useUsersStore } from '@/stores/users'

export default {
  name: 'App',

  components: {
    RouterLink,
    RouterView,
    AuthAndInitModal,
  },

  data() {
    const usersStore = useUsersStore()
    return {
      usersStore,
    }
  },

  computed: {
    token() {
      console.log('app.vue token:', this.usersStore.getToken)
      return this.usersStore.getToken
    },

    isInitialize() {
      return this.usersStore.getToken && this.usersStore.hasLoadedPeople
    },

  }
}
</script>