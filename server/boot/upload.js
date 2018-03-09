const fileUpload = require('express-fileupload');
const ensureDirectoryExistence = require('../lib/helpers').ensureDirectoryExistence

module.exports = app => {
  const authenticate = require('../middleware/authenticate')(app)

  app.use(fileUpload());
  app.post('/upload/:accountId', authenticate, function(req, res) {
    if (!req.files)
      return res.status(400).send('No files were uploaded.');
    const accountId = req.params.accountId
    let file = req.files.file;
    const name = (new Date().getTime())+file.name
    const filePath = `./client/uploads/${accountId}/${name}`
    ensureDirectoryExistence(filePath)
    file.mv(filePath, function(err) {
      if (err)
        return res.status(500)

      res.send({name});
    });
  });
}
