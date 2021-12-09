import axios from 'axios';
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
import Vue from 'vue';
import App from './App3.vue';
import './assets/common.scss';
import './assets/reset.min.css';

Vue.prototype.$http = axios
Vue.use(ElementUI);
Vue.config.productionTip = false

new Vue({
  render: h => h(App),
}).$mount('#app')
