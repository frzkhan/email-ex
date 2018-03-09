module.exports = app => {
  return (req, res, next) => {
    if(!req || !req.headers.authorization || !req.params.accountId) {
      const error = new Error('Unauthorized')
      error.status = 401
      return next(error)
    }
    const accessTokenId = req.headers.authorization
    const accountId = req.params.accountId.toString()

    app.models.AccessToken.findById(accessTokenId)
    .then(accessToken => {
      if (!accessToken || accessToken.userId.toString() !== accountId || !accessToken.isValid()) {
        const error = new Error('Unauthorized')
        error.status = 401
        return next(error)
      }
      next()
    })
  }
}
