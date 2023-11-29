const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser')
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const MongoDBStore = require('connect-mongodb-session')(session);

const { sessionHash, cookieConfig, maxAge, PORT, uri, jwtSecret } = require('./config');
const { getUsers, errorHandler } = require('./utils');
const { login, authenticate, validate } = require('./middlewares/user');

const { createUser, findUser } = require('./services/user');
const { fetchRooms } = require('./services/rooms');
const { saveMessageToDatabase, fetchMessages } = require('./services/messages');
const { fetchFriendRequests, createFriendRequest } = require('./services/friend');


const app = express();

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
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
  res.status(200).send({ rooms, friends })
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

io.use((socket, next) => {
  const user = socket.handshake.auth;
  if (!user) {
    return next(new Error("invalid user"));
  } else {
    socket.user = user;
    next();
  }
});

io.on("connection", async (socket) => {
  const users = [];

  for (let [id, clientSocket] of io.of("/").sockets) {
    users.push({
      ...clientSocket.user,
      userStatus: "online",
    });
  }

  const rooms = await getUsers(users, socket.user.id)

  rooms.forEach(({ rid }) => socket.join(rid.toString()))

  socket.to(rooms?.map(({ rid }) => rid.toString())).emit('connected', socket.user.id)

  socket.on('message', async (message) => {
    let newMessage = await saveMessageToDatabase(socket.user.id, message)

    if (!socket.rooms.has(newMessage.rid)) {
      socket.join(newMessage.rid)
    }
    try {
      if (newMessage.type === 2) {
        const base64Content = newMessage.content.toString('base64');
        newMessage = { ...newMessage.toJSON(), content: base64Content }
      }

      io.to(newMessage.rid).emit('message', newMessage)
    } catch (error) {
      console.error(error)
    }
  })


  socket.on('new-friend-request', async (reciever, callback) => {
    const request = await createFriendRequest(socket.user, reciever)
    callback(request)
  })

  socket.on('error', (error) => {
    console.error('Socket.IO server error: ', error)
  })
})