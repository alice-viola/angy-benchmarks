import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth.store';
import './assets/main.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

const publicPaths = ['/login', '/register'];
const shouldRestore = !publicPaths.includes(window.location.pathname);

if (shouldRestore) {
  const auth = useAuthStore();
  auth.fetchMe().finally(() => {
    app.mount('#app');
  });
} else {
  app.mount('#app');
}
