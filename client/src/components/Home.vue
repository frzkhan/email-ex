<template>
  <div>
    <div class="mail-box">
      <aside class="sm-side">
        <div class="inbox-body">
          <b-btn @click="composeModal()" class="btn-compose">Compose</b-btn>
          <b-modal ref="composeModal" size="lg" title="Compose" hide-footer>
            <b-form role="form" class="form-horizontal" @submit="sendEmail">
              <b-alert variant="danger" v-if="compose.errorMessage" show>{{compose.errorMessage}}</b-alert>
              <div class="form-group">
                <label class="col-lg-2 control-label">To</label>
                <div class="col-lg-10">
                  <input type="text" placeholder="" v-model="compose.to" id="inputEmail1" class="form-control">
                </div>
              </div>
              <div class="form-group">
                <label class="col-lg-2 control-label">Subject</label>
                <div class="col-lg-10">
                  <input type="text" placeholder="" v-model="compose.subject" id="inputPassword1" class="form-control">
                </div>
              </div>
              <div class="form-group">
                <label class="col-lg-2 control-label">Message</label>
                <div class="col-lg-10">
                  <vue-editor v-model="compose.content" useCustomImageHandler @imageAdded="handleImageAdded"></vue-editor>
                </div>
              </div>
              <div class="form-group">
                <label class="col-lg-2 control-label">Files</label>
                <div class="col-lg-10">
                  <ol>
                    <li v-for="file in compose.files">{{file}}</li>
                  </ol>
                </div>
              </div>
              <div class="form-group">
                <div class="col-lg-offset-2 col-lg-10">
                  <button class="btn btn-send" type="submit">Send</button>
                </div>
              </div>
            </b-form>
          </b-modal>
        </div>
        <ul class="inbox-nav inbox-divider">
          <li class="active">
            <a href="#" @click="setMailbox('inbox')"> <icon name="inbox"></icon> Inbox</a>
            <a href="#" @click="setMailbox('sent')"> <icon name="inbox"></icon> Sent</a>
            <a href="#" @click="setMailbox('junk')"> <icon name="inbox"></icon> Junk</a>
          </li>
        </ul>
      </aside>
      <aside class="lg-side">
        <div class="inbox-body">
          <input type="text" placeholder="Filter By Email" v-model="filterEmail" class="form-control">
          <div v-if="currentEmail">
            <b-btn @click="closeMail" class="btn-default" size="sm"><icon name="chevron-left"></icon></b-btn>
            <b-btn @click="composeModal(currentEmail)" class="btn-Primary" size="sm">Reply</b-btn>
            <hr>
            <h5>{{currentEmail.emailData.subject}}</h5>
            <hr>
            <small class="text-muted"><strong>{{currentEmail.emailData.from[0].name}}</strong> | {{currentEmail.emailData.from[0].address}}</small>
            <div class="email-body" v-html="currentEmail.emailData.html">
            </div>
            <div class="attachments" v-if="currentEmail.emailData.attachments && currentEmail.emailData.attachments.length">
              <div class="col-lg-10">
                <ol>
                  <li v-for="file in currentEmail.emailData.attachments"><a :href="downloadUrl(file.url)" target="_blank">{{file.name}}</a></li>
                </ol>
              </div>
            </div>
          </div>
          <b-btn @click="sync()" class="btn btn-default btn-sm"><icon :class="{sync: syncProgress}" name="repeat"></icon></b-btn>
          <table class="table table-inbox table-hover" v-if="!currentEmail && mailbox =='inbox'">
            <tbody>
              <tr :class="{'unread': !mail.seen}" @click="openMail(mail)" v-for="mail in filterInbox">
                <td class="view-message  dont-show">{{getFrom(mail.emailData)}}</td>
                <td class="view-message ">{{mail.emailData.subject || '(no subject)'}}</td>
                <td class="view-message  inbox-small-cells"><i class="fa fa-paperclip"></i></td>
                <td class="view-message  text-right" :title="(mail.emailData.date || mail.emailData.receivedDate) | formatDate">{{(mail.emailData.date || mail.emailData.receivedDate) | fromNow}}</td>
              </tr>
            </tbody>
          </table>
          <table class="table table-inbox table-hover" v-if="!currentEmail && mailbox =='sent'">
            <tbody>
              <tr :class="{'unread': !mail.seen}" @click="openMail(mail)" v-for="mail in filterSent">
                <td class="view-message  dont-show">{{getFrom(mail.emailData)}}</td>
                <td class="view-message ">{{mail.emailData.subject || '(no subject)'}}</td>
                <td class="view-message  inbox-small-cells"><i class="fa fa-paperclip"></i></td>
                <td class="view-message  text-right" :title="mail.emailData.date | formatDate">{{mail.emailData.date | fromNow}}</td>
              </tr>
            </tbody>
          </table>
          <table class="table table-inbox table-hover" v-if="!currentEmail && mailbox =='junk'">
            <tbody>
              <tr :class="{'unread': !mail.seen}" @click="openMail(mail)" v-for="mail in filterJunk">
                <td class="view-message  dont-show">{{getFrom(mail.emailData)}}</td>
                <td class="view-message ">{{mail.emailData.subject || '(no subject)'}}</td>
                <td class="view-message  inbox-small-cells"><i class="fa fa-paperclip"></i></td>
                <td class="view-message  text-right" :title="mail.emailData.date | formatDate">{{mail.emailData.date | fromNow}}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  </div>
</template>

<script>
import {HTTP} from '../services/http'
import orderBy from 'lodash/orderBy'
import get from 'lodash/get'
import { VueEditor } from 'vue2-editor'
export default {
  name: 'Home',
  components: {
    VueEditor
  },
  data () {
    return {
      mails: [],
      sent: [],
      junk: [],
      content: '',
      compose: {
        to: null,
        subject: null,
        content: null,
        messageId: null,
        errorMessage: null,
        files: []
      },
      currentEmail: null,
      syncProgress: false,
      mailbox: 'inbox',
      filterEmail: null
    }
  },
  created () {
    this.load()
    this.sync(true)
  },
  computed: {
    filterInbox () {
      if (!this.filterEmail) return this.mails
      return this.mails.filter(mail => mail.emailData.from[0].address.indexOf(this.filterEmail) >= 0)
    },
    filterSent () {
      if (!this.filterEmail) return this.sent
      return this.sent.filter(mail => mail.emailData.from[0].address.indexOf(this.filterEmail) >= 0)
    },
    filterJunk () {
      if (!this.filterEmail) return this.junk
      return this.junk.filter(mail => mail.emailData.from[0].address.indexOf(this.filterEmail) >= 0)
    }
  },
  methods: {
    downloadUrl (filename) {
      const accountId = HTTP.getCurrentUserId()
      return `/uploads/${accountId}/${filename}`
    },
    getFrom (emailData) {
      return get(emailData, 'from[0].name') || get(emailData, 'from[0].address')
    },
    handleImageAdded (file, Editor, cursorLocation) {
      const accountId = HTTP.getCurrentUserId()
      var formData = new FormData()
      formData.append('file', file)
      HTTP.post(`upload/${accountId}`, formData)
      .then((result) => {
        let url = result.data.name
        this.compose.files.push(url)
      })
      .catch((err) => {
        console.log(err)
      })
    },
    sync (repeat) {
      this.syncProgress = true
      const accountId = HTTP.getCurrentUserId()
      if (!accountId) return
      HTTP.get(`mailbox/${accountId}`)
      .then(res => {
        this.syncProgress = false
        this.load()
        if (repeat) {
          setTimeout(() => {
            this.sync(true)
          }, 10000)
        }
      })
      .catch(error => {
        console.log(error)
        if (repeat) {
          setTimeout(() => {
            this.sync(true)
          }, 10000)
        }
      })
    },
    load () {
      const accountId = HTTP.getCurrentUserId()
      if (!accountId) return
      HTTP.get(`/api/Accounts/${accountId}/connections`)
      .then(res => {
        if (res.data[0]) {
          const email = res.data[0].email
          return HTTP.get(`/api/Accounts/${accountId}/mails?filter[where][email]=${email}`)
        }
        return Promise.reject(new Error('Config not found for this account'))
      })
      .then(res => {
        const mails = orderBy(res.data, ['emailData.receivedDate', 'emailData.date'], ['desc', 'desc'])
        if (this.mails.length < mails.length) {
          this.mails = mails.filter(mail => mail.mailbox === 'inbox')
          this.junk = mails.filter(mail => mail.mailbox === 'junk')
          this.sent = mails.filter(mail => mail.mailbox === 'sent')
        }
      })
      .catch(error => {
        console.log(error)
      })
    },
    setMailbox (name) {
      this.currentEmail = null
      this.mailbox = name
    },
    sendEmail (evt) {
      evt.preventDefault()
      if (!this.compose.to || !this.compose.subject || !this.compose.content) {
        this.compose.errorMessage = 'All fields are required!'
        return this.compose.errorMessage
      }
      this.$refs.composeModal.hide()
      const accountId = HTTP.getCurrentUserId()
      HTTP.post(`mailbox/${accountId}`, this.compose)
      .then(() => {
        this.compose = {
          to: null,
          subject: null,
          content: null,
          messageId: null,
          errorMessage: null,
          files: []
        }
      })
    },
    composeModal (mail) {
      if (mail) {
        this.compose = {
          to: mail.emailData.from[0].address || null,
          subject: `re: ${mail.emailData.subject}` || null,
          content: null,
          messageId: mail.emailData.messageId || null,
          errorMessage: null,
          files: []
        }
      }

      this.$refs.composeModal.show()
    },
    openMail (mail) {
      this.currentEmail = mail
      const accountId = HTTP.getCurrentUserId()
      if (!mail.seen) {
        mail.seen = true
        HTTP.put(`/api/Accounts/${accountId}/mails/${mail.id}`, mail)
      }
    },
    closeMail () {
      this.currentEmail = null
    }
  }
}
</script>

<style scoped="">
body{font-family: 'Open Sans', sans-serif;}
	@import url('https://fonts.googleapis.com/css?family=Open+Sans');
	.mail-box {
    border-collapse: collapse;
    border-spacing: 0;
    display: table;
    table-layout: fixed;
    width: 100%;
}
  .sync {
  		-webkit-animation: rotation 0.8s infinite linear;
  }

  @-webkit-keyframes rotation {
  		from {
  				-webkit-transform: rotate(0deg);
  		}
  		to {
  				-webkit-transform: rotate(359deg);
  		}
  }
.mail-box aside {
    display: table-cell;
    float: none;
    height: 100%;
    padding: 0;
    vertical-align: top;
}
.mail-box .sm-side {
    background: none repeat scroll 0 0 #e5e8ef;
    border-radius: 4px 0 0 4px;
    width: 25%;
}
.mail-box .lg-side {
    background: none repeat scroll 0 0 #fff;
    border-radius: 0 4px 4px 0;
    width: 75%;
}
.mail-box .sm-side .user-head {
    background: none repeat scroll 0 0 #00a8b3;
    border-radius: 4px 0 0;
    color: #fff;
    min-height: 80px;
    padding: 10px;
}
.user-head .inbox-avatar {
    float: left;
    width: 65px;
}
.user-head .inbox-avatar img {
    border-radius: 4px;
}
.user-head .user-name {
    display: inline-block;
    margin: 0 0 0 10px;
}
.user-head .user-name h5 {
    font-size: 14px;
    font-weight: 300;
    margin-bottom: 0;
    margin-top: 15px;
}
.user-head .user-name h5 a {
    color: #fff;
}
.user-head .user-name span a {
    color: #87e2e7;
    font-size: 12px;
}
a.mail-dropdown {
    background: none repeat scroll 0 0 #80d3d9;
    border-radius: 2px;
    color: #01a7b3;
    font-size: 10px;
    margin-top: 20px;
    padding: 3px 5px;
}
.inbox-body {
    padding: 20px;
}
.btn-compose {
    background: none repeat scroll 0 0 #ff6c60;
    color: #fff;
    padding: 12px 0;
    text-align: center;
    width: 100%;
}
.btn-compose:hover {
    background: none repeat scroll 0 0 #f5675c;
    color: #fff;
}
ul.inbox-nav {
    display: inline-block;
    margin: 0;
    padding: 0;
    width: 100%;
}
.inbox-divider {
    border-bottom: 1px solid #d5d8df;
}
ul.inbox-nav li {
    display: inline-block;
    line-height: 45px;
    width: 100%;
}
ul.inbox-nav li a {
    color: #6a6a6a;
    display: inline-block;
    line-height: 45px;
    padding: 0 20px;
    width: 100%;
}
ul.inbox-nav li a:hover, ul.inbox-nav li.active a, ul.inbox-nav li a:focus {
    background: none repeat scroll 0 0 #d5d7de;
    color: #6a6a6a;
}
ul.inbox-nav li a i {
    color: #6a6a6a;
    font-size: 16px;
    padding-right: 10px;
}
ul.inbox-nav li a span.label {
    margin-top: 13px;
}
ul.labels-info li h4 {
    color: #5c5c5e;
    font-size: 13px;
    padding-left: 15px;
    padding-right: 15px;
    padding-top: 5px;
    text-transform: uppercase;
}
ul.labels-info li {
    margin: 0;
}
ul.labels-info li a {
    border-radius: 0;
    color: #6a6a6a;
}
ul.labels-info li a:hover, ul.labels-info li a:focus {
    background: none repeat scroll 0 0 #d5d7de;
    color: #6a6a6a;
}
ul.labels-info li a i {
    padding-right: 10px;
}
.nav.nav-pills.nav-stacked.labels-info p {
    color: #9d9f9e;
    font-size: 11px;
    margin-bottom: 0;
    padding: 0 22px;
}
.inbox-head {
    background: none repeat scroll 0 0 #0a05ff;
    border-radius: 0 4px 0 0;
    color: #fff;
    min-height: 80px;
    padding: 20px;
}
.inbox-head h3 {
    display: inline-block;
    font-weight: 300;
    margin: 0;
    padding-top: 6px;
}
.inbox-head .sr-input {
    border: medium none;
    border-radius: 4px 0 0 4px;
    box-shadow: none;
    color: #8a8a8a;
    float: left;
    height: 40px;
    padding: 0 10px;
}
.inbox-head .sr-btn {
    background: none repeat scroll 0 0 #00a6b2;
    border: medium none;
    border-radius: 0 4px 4px 0;
    color: #fff;
    height: 40px;
    padding: 0 20px;
}
.table-inbox {
    border: 1px solid #d3d3d3;
    margin-bottom: 0;
}
.table-inbox tr td {
    padding: 12px !important;
}
.table-inbox tr td:hover {
    cursor: pointer;
}
.table-inbox tr td .fa-star.inbox-started, .table-inbox tr td .fa-star:hover {
    color: #f78a09;
}
.table-inbox tr td .fa-star {
    color: #d5d5d5;
}
.table-inbox tr.unread td {
    background: none repeat scroll 0 0 #f7f7f7;
    font-weight: 600;
}
ul.inbox-pagination {
    float: right;
}
ul.inbox-pagination li {
    float: left;
}
.mail-option {
    display: inline-block;
    margin-bottom: 10px;
    width: 100%;
}
.mail-option .chk-all, .mail-option .btn-group {
    margin-right: 5px;
}
.mail-option .chk-all, .mail-option .btn-group a.btn {
    background: none repeat scroll 0 0 #fcfcfc;
    border: 1px solid #e7e7e7;
    border-radius: 3px !important;
    color: #afafaf;
    display: inline-block;
    padding: 5px 10px;
}
.inbox-pagination a.np-btn {
    background: none repeat scroll 0 0 #fcfcfc;
    border: 1px solid #e7e7e7;
    border-radius: 3px !important;
    color: #afafaf;
    display: inline-block;
    padding: 5px 15px;
}
.mail-option .chk-all input[type="checkbox"] {
    margin-top: 0;
}
.mail-option .btn-group a.all {
    border: medium none;
    padding: 0;
}
.inbox-pagination a.np-btn {
    margin-left: 5px;
}
.inbox-pagination li span {
    display: inline-block;
    margin-right: 5px;
    margin-top: 7px;
}
.fileinput-button {
    background: none repeat scroll 0 0 #eeeeee;
    border: 1px solid #e6e6e6;
}
.inbox-body .modal .modal-body input, .inbox-body .modal .modal-body textarea {
    border: 1px solid #e6e6e6;
    box-shadow: none;
}
.btn-send, .btn-send:hover {
    background: none repeat scroll 0 0 #00a8b3;
    color: #fff;
}
.btn-send:hover {
    background: none repeat scroll 0 0 #009da7;
}
.modal-header h4.modal-title {
    font-family: 'Open Sans', sans-serif !important;
    font-weight: 300;
}
.modal-body label {
    font-family: 'Open Sans', sans-serif !important;
    font-weight: 400;
}
.heading-inbox h4 {
    border-bottom: 1px solid #ddd;
    color: #444;
    font-size: 18px;
    margin-top: 20px;
    padding-bottom: 10px;
}
.sender-info {
    margin-bottom: 20px;
}
.sender-info img {
    height: 30px;
    width: 30px;
}
.sender-dropdown {
    background: none repeat scroll 0 0 #eaeaea;
    color: #777;
    font-size: 10px;
    padding: 0 3px;
}
.view-mail a {
    color: #ff6c60;
}
.attachment-mail {
    margin-top: 30px;
}
.attachment-mail ul {
    display: inline-block;
    margin-bottom: 30px;
    width: 100%;
}
.attachment-mail ul li {
    float: left;
    margin-bottom: 10px;
    margin-right: 10px;
    width: 150px;
}
.attachment-mail ul li img {
    width: 100%;
}
.attachment-mail ul li span {
    float: right;
}
.attachment-mail .file-name {
    float: left;
}
.attachment-mail .links {
    display: inline-block;
    width: 100%;
}

.fileinput-button {
    float: left;
    margin-right: 4px;
    overflow: hidden;
    position: relative;
}
.fileinput-button input {
    cursor: pointer;
    direction: ltr;
    font-size: 23px;
    margin: 0;
    opacity: 0;
    position: absolute;
    right: 0;
    top: 0;
    transform: translate(-300px, 0px) scale(4);
}
.fileupload-buttonbar .btn, .fileupload-buttonbar .toggle {
    margin-bottom: 5px;
}
.files .progress {
    width: 200px;
}
.fileupload-processing .fileupload-loading {
    display: block;
}
* html .fileinput-button {
    line-height: 24px;
    margin: 1px -3px 0 0;
}
* + html .fileinput-button {
    margin: 1px 0 0;
    padding: 2px 15px;
}
@media (max-width: 767px) {
.files .btn span {
    display: none;
}
.files .preview * {
    width: 40px;
}
.files .name * {
    display: inline-block;
    width: 80px;
    word-wrap: break-word;
}
.files .progress {
    width: 20px;
}
.files .delete {
    width: 60px;
}
}
ul {
    list-style-type: none;
    padding: 0px;
    margin: 0px;
}
</style>
