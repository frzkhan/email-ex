<template>
  <div class="col-md-4 login">
    <h1>Register</h1>
    <b-form @submit="register">
      <b-alert variant="danger" v-if="errorMessage" show>{{errorMessage}}</b-alert>
      <b-form-group id="exampleInputGroup1" label="Email address:" label-for="email">
        <b-form-input id="email" type="email" v-model="form.email" required placeholder="Enter email">
        </b-form-input>
      </b-form-group>
      <b-form-group label="Password:" label-for="password" description="">
        <b-form-input id="password" type="password" v-model="form.password" required placeholder="Enter password">
        </b-form-input>
      </b-form-group>
      <b-button type="submit" variant="primary">Register</b-button>
    </b-form>
    <br>
    <a href="#/login">Already have an account?</a>
  </div>
</template>

<script>
import {HTTP} from '../services/http'
export default {
  name: 'Register',
  data () {
    return {
      form: {
        email: '',
        password: ''
      },
      errorMessage: null
    }
  },
  created () {
    if (HTTP.isLoggedIn()) {
      this.$router.push('/')
    }
  },
  methods: {
    register (evt) {
      evt.preventDefault()
      if (!this.form.email || !this.form.password) {
        this.errorMessage = 'Both fields are required!'
        return this.errorMessage
      }
      HTTP.post('api/Accounts', {
        email: this.form.email,
        password: this.form.password
      })
      .then(() => {
        this.$router.push('/login')
      })
    }
  }
}
</script>

<style scoped>
  .login {
    margin: 0 auto;
  }
</style>
