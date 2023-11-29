require('dotenv').config()

module.exports = {
  cookieConfig: {
    secure: false,
    sameSite: 'strict',
    httpOnly: true,
  },
  maxAge: 1000 * 60 * 60 * 24 * 7,
  sessionHash: process.env.SESSION_HASH,
  passwordHash: process.env.PASSWORD_HASH,
  jwtSecret: process.env.JWT_SECRET,
  PORT: process.env.PORT || 4000,
  uri: process.env.MONGODB_URI
}
