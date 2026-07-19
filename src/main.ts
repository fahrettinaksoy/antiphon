import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './plugins/i18n'
import { vuetify } from './plugins/vuetify'
import router from './router'
import './styles/main.css'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App)

app.use(pinia)
app.use(router)
app.use(vuetify)
app.use(i18n)

app.mount('#app')
