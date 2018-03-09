<template>
  <div>
    <h1>Configuration</h1>
    <b-alert variant="primary" v-if="message" show>{{message}}</b-alert>
    <div class="text-muted col-md-12">
      <strong>Note</strong>: Allow your email to use lesssecureapps <br>
      Yahoo: <a href="https://login.yahoo.com/account/security">click here</a> <br>
    </div>
    <div class="col-md-4 float-left">
      <h5>Email Settings</h5>

      <b-form @submit="save">
        <b-alert variant="danger" v-if="errorMessage" show>{{errorMessage}}</b-alert>

        <b-form-group label="IMAP Host:" label-for="imap" description="">
          <b-form-input id="imap" type="text" v-model="form.host" required placeholder="Enter IMAP host">
          </b-form-input>
          <b-form-text id="input-help">
            example: imap.mail.yahoo.com
          </b-form-text>
        </b-form-group>
        <b-form-group label="SMTP Host:" label-for="smtp" description="">
          <b-form-input id="smtp" type="text" v-model="form.smtp" required placeholder="Enter SMTP host">
          </b-form-input>
          <b-form-text id="input-help">
            example: smtp.mail.yahoo.com
          </b-form-text>
        </b-form-group>
        <b-form-group id="exampleInputGroup1" label="Email address:" label-for="email">
          <b-form-input id="email" type="email" v-model="form.email" required placeholder="Enter email">
          </b-form-input>
          <b-form-text id="input-help">
            example: john@yahoo.com
          </b-form-text>
        </b-form-group>
        <b-form-group label="Password:" label-for="password" description="">
          <b-form-input id="password" type="password" v-model="form.password" required placeholder="Enter password">
          </b-form-input>
        </b-form-group>
        <b-button type="submit" variant="primary">Save</b-button>
      </b-form>
      <br>
    </div>
    <div class="col-md-4 float-right">
      <button @click="gmailConnect" v-if="!gmailConnected" class="btn btn-danger">
        <span>Connect to Gmail</span>
      </button>
      <button class="btn btn-danger" v-if="gmailConnected">
        <span>Connected to Gmail</span>
      </button>
      <button @click="setConfig('outlook')" class="btn btn-primary">
        <span>Outlook</span>
      </button>
      <button @click="setConfig('yahoo')" class="btn btn-info">
        <span>Yahoo</span>
      </button>
    </div>
  </div>
</template>

<script>
import {HTTP} from '../services/http'

export default {
  name: 'Configuration',
  data () {
    return {
      form: {
        host: '',
        smtp: '',
        email: '',
        password: '',
        provider: ''
      },
      errorMessage: null,
      gmailConnected: null,
      message: null
    }
  },
  created () {
    this.load()
  },
  methods: {
    setConfig (name) {
      switch (name) {
        case 'outlook':
          this.form = {
            host: 'imap-mail.outlook.com',
            smtp: 'smtp-mail.outlook.com',
            email: '',
            password: '',
            provider: 'outlook'
          }
          break
        case 'yahoo':
          this.form = {
            host: 'imap.mail.yahoo.com',
            smtp: 'smtp.mail.yahoo.com',
            email: '',
            password: '',
            provider: 'yahoo'
          }
          break
      }
    },
    gmailConnect () {
      window.open(process.env.BACKEND_API + 'token?account_id=' + HTTP.getCurrentUserId(), 'Gmail Connect', 'width=800,height=600')
      window.addEventListener('message', event => {
        if (event.data) {
          this.gmailConnected = true
        }
      }, false)
    },
    save (evt) {
      evt.preventDefault()
      if (!this.form.host || !this.form.email || !this.form.password) {
        this.errorMessage = 'All fields required'
        return this.errorMessage
      }
      const accountId = HTTP.getCurrentUserId()
      if (!accountId) {
        this.errorMessage = 'Invalid login'
        return this.errorMessage
      }
      HTTP.delete(`api/Accounts/${accountId}/connections`)
      .then(() => {
        return HTTP.post(`api/Accounts/${accountId}/connections`, this.form)
      })
      .then(connection => {
        this.message = 'Configuration saved'
      })
    },
    load () {
      const accountId = HTTP.getCurrentUserId()
      HTTP.get(`api/Accounts/${accountId}/connections`)
      .then(res => {
        const connection = res.data[0]
        if (!connection) return
        if (connection.accessToken) {
          this.gmailConnected = true
        }
        this.form = {
          host: connection.host,
          smtp: connection.smtp,
          email: connection.email
        }
      })
    }
  }
}
</script>

<style>
</style>
