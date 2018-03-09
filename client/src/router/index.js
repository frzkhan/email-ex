import Vue from 'vue'
import Router from 'vue-router'
import Login from '@/components/Login'
import Register from '@/components/Register'
import Home from '@/components/Home'
import Configuration from '@/components/Configuration'
import {HTTP} from '../services/http'
Vue.use(Router)

const router = new Router({
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home,
      beforeEnter: (to, from, next) => {
        if (HTTP.isLoggedIn()) next()
      }
    },
    {
      path: '/login',
      name: 'Login',
      component: Login,
      beforeEnter: (to, from, next) => {
        if (!HTTP.isLoggedIn()) next()
      }
    },
    {
      path: '/register',
      name: 'Register',
      component: Register,
      beforeEnter: (to, from, next) => {
        if (!HTTP.isLoggedIn()) next()
      }
    },
    {
      path: '/configuration',
      name: 'Configuration',
      component: Configuration,
      beforeEnter: (to, from, next) => {
        if (HTTP.isLoggedIn()) next()
      }
    }
  ]
})

if (!HTTP.isLoggedIn()) {
  router.push('/login')
} else {
  router.push('/')
}
export default router
