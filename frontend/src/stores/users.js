import { defineStore } from 'pinia'

export const useUsersStore = defineStore('users', {

  state: () => ({
    token: null,
    people: null,
    _hasLoadedPeople: false
  }),

  getters: {
    getToken: (state) => state.token,
    hasLoadedPeople: (state) => state._hasLoadedPeople,
    getPeople: (state) => state.people || [],
  },

  actions: {
    saveToken(newToken) {
      this.token = newToken
      localStorage.setItem('authToken', newToken)
    },
    loadToken() {
      this.token = localStorage.getItem('authToken')
    },
    savePeople(people) {
      this._hasLoadedPeople = true
      this.people = people
    },
  },

})
