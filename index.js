const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser')
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const mongoose = require('mongoose');
const http = require('http');
const MongoDBStore = require('connect-mongodb-session')(session);
const { users } = require('./constants')
const { sessionHash, cookieConfig, maxAge, PORT, uri, jwtSecret, origin } = require('./config');
const { errorHandler, getStatusFromUsers, addStatusToUser } = require('./utils');
const { login, authenticate, validate } = require('./middlewares/user');
const { createUser, findUser } = require('./services/user');
const { fetchRooms } = require('./services/rooms');
const { fetchMessages } = require('./services/messages');
const { fetchFriendRequests } = require('./services/friend');

const mainHandler = require('./Handlers/mainHandler')
const mediasoupHandler = require('./Handlers/mediasoupHandler')

const app = express();

const server = http.createServer(app)

const io = require('socket.io')(server, {
  cors: {
    origin,
    methods: ["GET", "POST"]
  }
})

const store = new MongoDBStore({
  uri: uri,
  collections: "sessions",
  expires: maxAge
})

app.use(express.json());
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cors())

app.use(session({
  name: "connect.sid",
  secret: sessionHash,
  resave: false,
  saveUninitialized: false,
  store,
  cookies: cookieConfig
}))

const init = async () => {
  try {
    await mongoose.connect(uri)
    server.listen(PORT, () => {
      console.log(`server up on port: ${PORT}`);
    })
  } catch (error) {
    console.error(error)
  }
}

init();

app.get('/data', authenticate, async (req, res) => {
  const rooms = await fetchRooms(req.user.id);
  const friends = await fetchFriendRequests(req.user.id) || []
  const userStatusList = await getStatusFromUsers(users, req.user.id);
  const processedRooms = await addStatusToUser(rooms, userStatusList)
  const processedFriends = await addStatusToUser(friends, userStatusList)
  res.status(200).send({ rooms: processedRooms, friends: processedFriends })
})

app.get('/:rid/messages', authenticate, async (req, res) => {
  const messages = await fetchMessages(req.user.id, req.params.rid);
  res.status(200).send({ messages })
})

app.post('/sign-in', login, async (req, res) => {
  const user = await findUser(req.body)

  if (!user) {
    return res.status(401).json({ error: "There was an issue with the credentials." })
  }

  try {
    const accessToken = jwt.sign({ user }, jwtSecret, { expiresIn: "1h" })
    const refreshToken = jwt.sign({ user }, jwtSecret, { expiresIn: "7d" })

    res.cookie('refreshToken', refreshToken, cookieConfig)
      .header('Authorization', accessToken)
      .json({ user: user })
  } catch (error) {
    errorHandler(res)
  }
})

app.post('/refresh', (req, res) => {
  const refreshToken = req.cookies['refreshToken'];
  if (!refreshToken) {
    return res.status(401).json({ message: 'Access Denied. No refresh token provided.' })
  }

  try {
    const decoded = jwt.verify(refreshToken, jwtSecret)
    const accessToken = jwt.sign({ user: decoded.user }, jwtSecret, { expiresIn: "1h" })

    res.header('Authorization', accessToken)
      .send(decoded.user)
  } catch (error) {
    return res.status(400).json({ message: "Invalid refresh token" })
  }
})

app.post('/sign-up', validate, async (req, res) => {
  const newUser = await createUser(req.body);
  res.sendStatus(201)
})

store.on("error", function (error) {
  console.error(error);
});

const onConnection = (socket) => {
  mainHandler(io, socket)
  mediasoupHandler(socket)
}

io.use((socket, next) => {
  const user = socket.handshake.auth;
  if (!user) {
    return next(new Error("invalid user"));
  } else {
    socket.user = user;
    delete socket.handshake.auth;
    next();
  }
});

io.on("connection", onConnection)