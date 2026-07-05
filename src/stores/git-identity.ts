import { defineStore } from 'pinia'

export const useGitIdentityStore = defineStore('gitIdentity', {
  state: () => ({
    name: '',
    email: ''
  }),
  persist: true
})
