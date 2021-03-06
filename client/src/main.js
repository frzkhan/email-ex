// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import BootstrapVue from 'bootstrap-vue'
import 'vue-awesome/icons'
import moment from 'moment'
import Icon from 'vue-awesome/components/Icon'
import App from './App'
import router from './router'

import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

Vue.filter('formatDate', function (value) {
  if (value) {
    return moment(String(value)).format('MM/DD/YYYY hh:mm')
  }
})
Vue.filter('fromNow', function (value) {
  if (value) {
    return moment(String(value)).fromNow()
  }
})
Vue.use(BootstrapVue)
Vue.component('icon', Icon)
Vue.config.productionTip = false

/* eslint-disable no-new */
new Vue({
  el: '#app',
  router,
  template: '<App/>',
  components: { App }
})
