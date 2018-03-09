import axios from 'axios'
import HttpStatus from 'http-status-codes'

const httpBackend = axios.create({
  baseURL: process.env.BACKEND_API
})

const methods = {
  cacheItem (name, value) {
    // eslint-disable-next-line no-undef
    localStorage.setItem(name, JSON.stringify(value))
  },
  getCacheItem (name) {
    // eslint-disable-next-line no-undef
    return JSON.parse(localStorage.getItem(name))
  },
  clearCachedItems () {
    // eslint-disable-next-line no-undef
    localStorage.clear()
  },
  isExpiredToken (auth) {
    const MS_MULTIPLIER = 1000
    const ttl = auth.ttl * MS_MULTIPLIER
    const now = new Date().getTime()

    return (new Date(auth.created).getTime() + ttl) <= now
  },
  isLoggedIn () {
    const auth = this.getCacheItem('Authorization')

    return (auth && auth.id && !this.isExpiredToken(auth))
  },
  getCurrentUserId () {
    const auth = this.getCacheItem('Authorization')

    if (auth && auth.id && !this.isExpiredToken(auth)) {
      return auth.userId
    }
    return null
  },
  login (credentials) {
    return httpBackend.post('api/Accounts/login', credentials)
    .then(response => {
      if (response.status === HttpStatus.OK) {
        httpBackend.defaults.headers.common.authorization = response.data.id
        this.cacheItem('Authorization', response.data)
      }
      return response
    })
  },
  logout () {
    return httpBackend.post('api/Accounts/logout')
    .then(response => {
      delete httpBackend.defaults.headers.common.authorization
      this.clearCachedItems()
      return response
    })
  }
}

if (methods.isLoggedIn()) {
  const auth = methods.getCacheItem('Authorization')

  httpBackend.defaults.headers.common.authorization = auth.id
}

export const HTTP = Object.assign({}, httpBackend, methods)
