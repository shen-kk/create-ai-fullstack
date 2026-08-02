import './style.css';

import { createApp } from 'vue';

import App from './App.vue';
import { router } from './router';
import { project } from './generated/project';

document.title = project.displayName;
createApp(App).use(router).mount('#app');
