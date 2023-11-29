const jwt = require('jsonwebtoken');
const { cookieConfig, jwtSecret } = require('../config');
const { errorHandler } = require('../utils');
const { isUniqueValue } = require('../services/user');

const emailRegex = /^[a-zA-Z0-9._%+-]{4,40}@[a-zA-Z0-9.-]{2,20}\.[a-zA-Z]{2,4}$/
const usernameRegex = /^[a-zA-Z0-9]{6,24}$/
const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,24}$/

const login = (req, res, next) => {
  const { email, password } = req.body;

  try {
    if (!emailRegex.test(email))
      return errorHandler(res, "incorrect-email-password");
    if (!passwordRegex.test(password))
      return errorHandler(res, "incorrect-email-password");

    next()
  } catch (error) {
    errorHandler(res, "bad-request")
  }
}

const authenticate = (req, res, next) => {
  const accessToken = req.headers['Authorization'];
  const refreshToken = req.cookies['refreshToken'];
  console.log(accessToken, refreshToken)
  if (!accessToken && !refreshToken) {
    return errorHandler(res, 'no-tokens')
  }

  try {
    const decoded = jwt.verify(accessToken, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    if (!refreshToken) {
      return errorHandler(res, 'no-refresh-token')
    }

    try {
      const decoded = jwt.verify(refreshToken, jwtSecret);
      const accessToken = jwt.sign({ user: decoded.user }, jwtSecret, { expiresIn: "1h" })

      res.cookie('refreshToken', refreshToken, cookieConfig)
        .header("authorization", accessToken)

      req.user = decoded.user
      next()
    } catch (error) {
      return errorHandler(res, 'invalid-token')
    }
  }
}

const validate = async (req, res, next) => {
  const { email, username, password, confirmPassword } = req.body;

  if (!emailRegex.test(email)) {
    console.log('1', email)
    return errorHandler(res, "invalid-email")
  }
  if (!usernameRegex.test(username)) {
    console.log('2', username)
    return errorHandler(res, "invalid-username")
  }
  if (!passwordRegex.test(password)) {
    return errorHandler(res, "invalid-password")
  }
  if (password !== confirmPassword) {
    return errorHandler(res, "passwords-not-match")
  }
  const emailExists = await isUniqueValue('email', email)
  if (emailExists) {
    return errorHandler(res, "email-exists")
  }
  const usernameExists = await isUniqueValue('username', username)
  if (usernameExists) {
    return errorHandler(res, "username-exists")
  }

  next()
}

module.exports = {
  login,
  authenticate,
  validate
}