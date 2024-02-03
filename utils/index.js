const crypto = require('crypto');
const mediasoup = require("mediasoup");
const { passwordHash } = require("../config");
const { mediasoup: { worker: { logLevel, logTags, rtcMaxPort, rtcMinPort } } } = require("../config/mediasoup-config");
const { fetchRooms } = require('../services/rooms.js');
const { users } = require('../constants');


const createHashedPassword = (password) =>
  crypto.createHmac("sha256", passwordHash).update(password).digest("hex");

const errorHandler = (res = null, type, error = null) => {
  switch (type) {
    case "bad-request":
      return res.status(400).json({ error: "Bad request." })
    case "incorrect-email-password":
      return res.status(401).json({ error: "Incorrect Email or Password." })
    case 'invalid-email':
      return res.status(400).json({ error: "Email does not match the rules!" })
    case 'invalid-username':
      return res.status(400).json({ error: "Username does not match the rules!" })
    case 'invalid-password':
      return res.status(400).json({ error: "Password does not match the rules!" })
    case 'passwords-not-match':
      return res.status(400).json({ error: "Passwords do not match" })
    case "email-exists":
      return res.status(400).json({ error: "Email already exists" });
    case "username-exists":
      return res.status(400).json({ error: "Username already exists" });
    case "no-tokens":
      return res.status(401).json({ error: 'Access Denied. No token provided.' });
    case "no-refresh-token":
      return res.status(401).json({ error: 'Access Denied. No refresh token provided.' });
    case "invalid-token":
      return res.status(400).json({ error: 'Invalid Token.' });
    case "ValidationError":
      let errors = {};

      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });

      return errors;
    default:
      return res.status(500).json({ error: "Something went wrong. try again later!" });
  }
}

const createWorker = async () => {
  let worker;
  worker = await mediasoup.createWorker({ logLevel, logTags, rtcMinPort, rtcMaxPort });
  console.log(`worker pid ${worker.pid}`);

  worker.on("died", (error) => {
    console.error("mediasoup worker has died");
    setTimeout(() => process.exit(1), 2000);
  });

  return worker;
};

const getSocketID = (userID) => {
  return users.find(({ id }) => id === userID)?.socketID;
}

const findRoom = (rooms, targetID) => {
  return rooms.find((room) => {
    return room.recipients[1].id === targetID;
  });
};

const getUsers = async (users, currentUserID) => {
  const rooms = await fetchRooms(currentUserID);
  const list = [];

  rooms?.forEach(({ id, recipients }) => {
    const foundUser = users.find((userItem) => {
      return userItem.id === recipients.id.toString() && userItem.id !== currentUserID;
    });

    if (foundUser) {
      list.push({
        rid: id,
        ...foundUser,
        status: foundUser.status,
      });
    } else {
      list.push({
        rid: id,
        id: recipients.id,
        username: recipients.username,
        avatar: recipients.avatar,
        status: "offline",
      });
    }
  });

  return list;
}

const getStatusFromUsers = (clientID) => {
  return users.filter(user => user.id !== clientID).map(({ id, status }) => {
    return {
      id,
      status
    }
  });
}

const addStatusToUser = (list, userStatusList) => {
  return list.map(item => {
    const foundStatus = userStatusList?.find(status => status.id === item.user.id)
    return {
      ...item,
      user: {
        ...item.user,
        status: foundStatus?.status || "offline"
      }
    }
  });
}

module.exports = {
  errorHandler,
  createHashedPassword,
  getSocketID,
  createWorker,
  findRoom,
  getUsers,
  getStatusFromUsers,
  addStatusToUser,

};