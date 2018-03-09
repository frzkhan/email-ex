var MailParser = require("mailparser-mit").MailParser;
const Imap = require('imap')
const async = require('async')
const nodemailer = require('nodemailer')
const MailComposer = require("mailcomposer").MailComposer
const google = require('googleapis');
const xoauth2 = require("xoauth2")
const _ = require('lodash')
const P = require('bluebird')
const fs = require('fs')
const path = require('path')
const base64  = require('base64-stream')

const ensureDirectoryExistence = require('../lib/helpers').ensureDirectoryExistence

const OAuth2 = google.auth.OAuth2;
const clientId = '497186199220-sk5odorqcl78sh7abmm622ssbu819qpn.apps.googleusercontent.com'
const clientSecret = 'yjeGs_RbaaMT5BNXIZc2lwQa'

const scopes = [
  'https://mail.google.com/',
  'email'
];
module.exports = app => {
  const Account = app.models.Account
  const Mail = app.models.Mail
  const authenticate = require('../middleware/authenticate')(app)

  function fetchMailBox (options) {
    return new Promise((resolve, reject) => {
      options.imapConnection.search([ 'ALL' ], function(err, resultInbox) {
        if(err) return reject(err)
        if (!resultInbox.length) {
          return resolve(0)
        }
        console.log('mails found')
        var f = options.imapConnection.fetch(resultInbox, { bodies: '', markSeen: true, struct: true });
        options.imapConnection.move(resultInbox, `mbox-${options.mailboxAlt}`, err => {
          if(err)
          return console.error('move error', options.mailbox, err);
          console.log('Moving mails to backup boxes');
        })
        const mails = []
        f.on('message', function(msg, seqno) {
          let mailData = ''
          let attachments = null
          msg.on('body', (stream, info) => {
            let buffer = ''
            stream.on('data', chunk => {
              buffer += chunk.toString('utf8')
            })
            stream.once('end', () => {
              mailData += buffer
            })
          })
          .once('end', () => {
            mails.push({mailData, attachments})
          })
          msg.once('attributes', attrs => {
            const att = findAttachmentParts(attrs.struct);
            if (att.length) {
              attachments = att.map(attachment => {
                const time = new Date().getTime()
                const filename = _.get(attachment, 'params.name') || _.get(attachment, 'disposition.params.filename')
                attachment.filename = `./client/uploads/${options.accountId}/${time}-${filename}`
                var f = options.imapConnection.fetch(attrs.uid , {
                  bodies: [attachment.partID],
                  struct: true
                });
                f.once('message', buildAttMessageFunction(attachment));
                return {
                  url: `${time}-${filename}`,
                  name: filename,
                }
              })
            }
          })
        }).on('end', function() {
          async.map(mails, (mail, cb) => {
            parseEmail(mail.mailData, (obj) => {
              delete obj.attachments
              obj.attachments = mail.attachments
              cb(null, Mail.create({
                userId: options.accountId,
                email: options.connection.email,
                emailData: obj,
                mailbox: options.mailboxAlt
              }))
            })
          }, (err, results) => {
            if (err) {
              return reject(err)
            }
            P.each(results, () => {
              console.log('mail received');
            })
            .then(synced => {
              console.log('Finished: ', synced.length);
              return resolve(synced.length)
            })
            .catch(mailerror => {
              console.log('Save Mail ERROR:', mailerror);
            })
          })
        })
        .on('error', error => {
          console.log('Fetch mail ERROR:', error);
        })
      })
    })
  }
  app.get('/mailbox/:accountId', authenticate, (req, res) => {
    const accountId = req.params.accountId

    return getConnection(accountId)
    .then(connection => {
      getImapConnection(connection, imapConnection => {
        imapConnection.once('ready', () => {
          const boxMap = {
            junk: null,
            sent: null,
            inbox: null
          }
          function openBox (mailbox) {
            return new Promise((resolve, reject) => {
              imapConnection.openBox(boxMap[mailbox], true, (err, box) => {
                if (err) return reject(err)
                fetchMailBox({
                  mailboxAlt: mailbox,
                  mailbox: boxMap[mailbox],
                  connection,
                  accountId,
                  imapConnection
                })
                .then(synced => {
                  resolve(synced)
                })
                .catch(error => {
                  console.log('error in fetch', error);
                  reject(error)
                })
              })
            })
          }
          const syncedBoxes = {
            inbox: 0,
            junk: 0,
            sent: 0
          }
          imapConnection.getBoxes((error, boxes) => {
            if(error) throw error
            if (boxes['[Gmail]'] && boxes['[Gmail]'].children) {
              const children = boxes['[Gmail]'].children;
              const sentMailName = Object.keys(children).filter((name) => {
                return (children[name].attribs.includes('\\Sent'));
              })[0];
              const junkMailName = Object.keys(children).filter((name) => {
                return (children[name].attribs.includes('\\Junk'));
              })[0];
              if (sentMailName !== undefined) {
                boxMap.sent = `[Gmail]/${sentMailName}`
              }
              if (junkMailName !== undefined) {
                boxMap.junk = `[Gmail]/${junkMailName}`
              }
              boxMap.inbox = 'INBOX'
            }
            if (!boxes['[Gmail]']) {
              const sentMailName = Object.keys(boxes).filter(name => {
                return boxes[name].attribs.includes('\\Sent')
              })[0]
              const junkMailName = Object.keys(boxes).filter(name => {
                return boxes[name].attribs.includes('\\Junk')
              })[0]
              if (sentMailName !== undefined) {
                boxMap.sent = sentMailName
              }
              if (junkMailName !== undefined) {
                boxMap.junk = junkMailName
              }
              boxMap.inbox = 'Inbox'
            }
            function addBoxes (boxObj) {
              const boxKeys = Object.keys(boxObj)
              return P.each(boxKeys, key => {
                return new Promise(resolve => {
                  imapConnection.addBox(`mbox-${key}`, () => {
                    resolve()
                  })
                })
              })
            }
            Promise.resolve(addBoxes(boxMap))
            .then(() => {
              return openBox('inbox')
            })
            .then(syncedData => {
              syncedBoxes.inbox = syncedData
              return openBox('junk')
            })
            .then(syncedData => {
              syncedBoxes.junk = syncedData
              return openBox('sent')
            })
            .then(syncedData => {
              syncedBoxes.sent = syncedData
              imapConnection.end()
              res.send(syncedBoxes)
            })
            .catch(error => {
              console.error(error);
            })
          })
        })
        imapConnection.once('close', error => {
          //console.log('Closed: ', error);
        })
        imapConnection.once('error', (error) => {
          console.error('Imap connection ERROR: ',error);
          imapConnection.end()
          res.end()
        })
      })
    })
    .catch(error => {
      console.error(error, 'connection error')
      res.send(error)
    })
  })
  app.post('/mailbox/:accountId', authenticate, (req, res) => {
    const accountId = req.params.accountId
    const compose = req.body
    let data = {
      to: `${compose.to}`,
      subject: `${compose.subject}`,
      html: `${compose.content}`,
      attachments: compose.files.map(file => {
        return {
          filePath: `${process.env.BACKEND_API}/uploads/${accountId}/${file}`
        }
      })
    };
    return sendEmail(accountId, data)
    .then(sent => {
      res.send(sent)
    })
  })
  app.get('/token', (req, res) => {
    const oauth2Client = new OAuth2(
      clientId,
      clientSecret,
      process.env.BACKEND_API + '/token/callback'
    );
    var url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: req.query.account_id
    });
    res.redirect(url+'&approval_prompt=force');
  })
  app.get('/token/callback', (req, res) => {
    const code = req.query.code
    const accountId = req.query.state

    if(!accountId) {
      res.render(`token.ejs`, {
        response: 'error',
      })
      return
    }
    const oauth2Client = new OAuth2(
      clientId,
      clientSecret,
      process.env.BACKEND_API + '/token/callback'
    );
    oauth2Client.getToken(code, function (err, tokens) {
      oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token
      });
      let email = null
      getUserEmail(oauth2Client)
      .then(userEmail => {
        email = userEmail
        if (!email) {
          res.render(`token.ejs`, {
            response: 'error',
          })
          return
        }
        return Account.findById(accountId)
      })
      .then(account => {
        if (!account) {
          res.render(`token.ejs`, {
            response: 'error',
          })
          return
        }
        return account.connections.destroyAll()
        .then(() => {
          const connection = account.connections.build({
            email,
            provider: 'google',
            host: "imap.gmail.com",
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token
          })
          return connection.save()
        })
      })
      .then(() => {
        res.render(`token.ejs`, {
          response: tokens,
        })
      })
      .catch(error => {
        console.error(error);
      })
    });
  })

  function getUserEmail (oauth2Client) {
    return new Promise((resolve, reject) => {
      const plus = google.plus('v1');
      plus.people.get({
        userId: 'me',
        auth: oauth2Client
      }, (err, response) => {
        if (err) return reject(err)
        const email = _.get(response, 'emails[0].value')
        return resolve(email)
      })
    })
  }
  function getConnection (accountId) {
    return Account.findById(accountId)
    .then(account => account.connections.find())
    .then(connections => {

      if(connections.length) {
        return connections[0]
      }
      return Promise.reject('No configuration found')
    })
  }

  function getImapConnection (connection, cb) {
    console.log(connection);
    let config = {
      user: connection.email,
      host: connection.host,
      tls: true,
      port: 993,
      authTimeout: 500000,
      debug: console.log
    }
    if (connection.refreshToken && connection.accessToken) {
      genXoauth(connection, xoauth2token => {
        config.xoauth2 = xoauth2token
        const imapConnection = new Imap(config);
        imapConnection.connect();
        cb(imapConnection)
      })
      return
    }
    config.password = connection.password
    const imapConnection = new Imap(config);
    imapConnection.connect();
    cb(imapConnection)
  }
  function genXoauth (connection, cb) {
    const xoauth2gen = xoauth2.createXOAuth2Generator({
      user: connection.email,
      clientId,
      clientSecret,
      refreshToken: connection.refreshToken
    });
    xoauth2gen.getToken((err, xoauth2token) => {
      if (err) {
        return console.error(err)
      }
      cb(xoauth2token)
    })
  }
  function findAttachmentParts(struct, attachments) {
    attachments = attachments ||  []
    if(!struct) return
    struct.forEach((i) => {
      if (Array.isArray(i)) findAttachmentParts(i, attachments)
      else if (i.disposition && ['INLINE', 'ATTACHMENT'].indexOf(_.toUpper(i.disposition.type)) > -1) {
        attachments.push(i)
      }
    })
    return attachments
  }

  function buildAttMessageFunction(attachment) {
    var filename = attachment.filename;
    var encoding = attachment.encoding;
    ensureDirectoryExistence(filename)

    return function (msg, seqno) {
      var prefix = '(#' + seqno + ') ';
      msg.on('body', function(stream, info) {
        var writeStream = fs.createWriteStream(filename);
        writeStream.on('finish', function() {
          console.log(prefix + 'Done writing to file %s', filename);
        });
        if (encoding === 'base64') {
          stream.pipe(base64.decode()).pipe(writeStream);
        } else  {
          stream.pipe(writeStream);
        }
      });
      msg.once('end', function() {
        console.log(prefix + 'Finished attachment %s', filename);
      });
    };
  }

  function getSmtpConnection (connection) {
    return new Promise((resolve, reject) => {
      if (connection.refreshToken && connection.accessToken) {
        let smtpConfig = {
          service: 'Gmail',
          auth: {
            XOAuth2: {
              user: connection.email,
              clientId,
              clientSecret,
              refreshToken: connection.refreshToken
            }
          }
        }
        let transporter = nodemailer.createTransport("SMTP", smtpConfig)
        resolve(transporter)
        return
      }
      let smtpConfig = {
        host: connection.smtp,
        port: connection.provider === 'outlook'? 587: 465,
        secure: true,
        secureConnection: connection.provider === 'outlook'? false: true,
        auth: {
          user: connection.email,
          pass: connection.password
        }
      };
      let transporter = nodemailer.createTransport("SMTP", smtpConfig)
      resolve(transporter)
    })
  }

  function sendEmail(accountId, data) {
    const emailData = data
    const ctx = {}
    return getConnection(accountId)
    .then(connection => {
      ctx.connection = connection
      emailData.from = connection.email
      return getSmtpConnection(connection)
    })
    .then(transporter => transporter.sendMail(emailData, err => console.log(err)))
    .then(sent => {
      if(ctx.connection.provider !== 'yahoo') return
      var mail = new MailComposer();
      mail.setMessageOption(emailData)
      mail.addHeader("date", new Date(Date.now()));
      mail.addHeader("receivedDate", new Date(Date.now()));
      emailData.attachments.forEach(attachment => {
        mail.addAttachment(attachment)
      })
      mail.buildMessage(function(err, message){
        if(err) return console.error(err, 'buildMessage');
        getImapConnection(ctx.connection, imapConnection => {
          imapConnection.once('ready', () => {
            imapConnection.getBoxes((error, boxes) => {
              if (error) return console.error(error, 'getBoxes');
              if(!error) {
                let sentmailbox = null
                if (boxes['[Gmail]']) {
                  sentmailbox = '[Gmail]/Sent Mail'
                } else {
                  sentmailbox = Object.keys(boxes).filter(name => {
                    return boxes[name].attribs.includes('\\Sent')
                  })[0]
                }
                imapConnection.append(message, {
                  mailbox: sentmailbox,
                  date: new Date(Date.now())
                }, err => {
                  console.error(err);
                })
                imapConnection.end()
              }
            })
          })
          imapConnection.once('error', (error) => {
            console.error('SMTP:', 'Disconnect', error);
          })
        })
      })
    })
    .catch(error => {
      console.error(error,'sending failed');
    })
  }

  function parseEmail(emailData, cb) {
    var mp = new MailParser();
    mp.on('end', function(obj) {
      cb(obj)
    });
    mp.write(emailData)
    mp.end()
  }
}
