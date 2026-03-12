import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './style.css';
import App from './App.vue';
import router from './router';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

app.config.errorHandler = (err, _instance, info) => {
  console.error('Unhandled error:', err, info);
  // Toast will be available after the app is mounted
  // We use a dynamic import to avoid circular deps
  import('./composables/useToast').then(({ useToast }) => {
    const { addToast } = useToast();
    addToast({
      type: 'error',
      title: 'Unexpected Error',
      message: err instanceof Error ? err.message : 'An unexpected error occurred',
    });
  });
};

app.mount('#app');
