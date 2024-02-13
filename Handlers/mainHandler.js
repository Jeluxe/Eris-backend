const { addMessage, editMessage, deleteMessage } = require('../services/messages');
const { createFriendRequest, updateFriendRequest } = require('../services/friend');
const globalUsersState = require("../constants")
const { getUsers, getSocketID } = require('../utils');
const { getRoom, createRoom } = require('../services/rooms');
const { findUserByUsername } = require('../services/user');

module.exports = async (io, socket) => {
  for (let [id, socketClient] of io.of("/").sockets) {
    if (!globalUsersState.users.find(user => user?.id === socketClient.user.id)) {
      globalUsersState.users.push({
        ...socketClient.user,
        socketID: id,
        status: "online",
      });
    } else {
      globalUsersState.users = globalUsersState.users.map(user => {
        if (user.id === socketClient.user.id) {
          return {
            ...user,
            socketID: id
          }
        }
        return user
      })
    }
  }
  console.log('main socket on!')
  const rooms = await getUsers(socket.user.id)

  const broadcastUserStatusUpdate = (status) => {
    socket.to(rooms?.map(({ rid }) => rid.toString())).emit('user-connected', socket.user.id, status)
  }

  rooms.forEach(({ rid }) => socket.join(rid.toString()))

  broadcastUserStatusUpdate('online')

  socket.on('message', async (message, cb) => {
    try {
      if (message.temp) {
        const foundRoom = await createRoom(socket.user.id, message.rid)
        message.rid = foundRoom.id;
      }
      let newMessage = await addMessage(socket.user.id, message)

      if (!socket.rooms.has(newMessage.rid)) {
        socket.join(newMessage.rid)
      }
      if (newMessage.type === 2) {
        const base64Content = newMessage.content.toString('base64');
        newMessage.content = base64Content;
      }
      cb(newMessage);
      socket.broadcast.to(newMessage.rid).emit('message', newMessage)
    } catch (error) {
      console.error(error)
      cb(error)
    }
  })

  socket.on('edit-message', async ({ message, newContent }, cb) => {
    try {
      const foundRoom = await getRoom(socket.user.id, message.rid);
      const editedMessage = await editMessage(message.id, newContent);
      cb({ editedMessage })
      socket.broadcast.to(foundRoom.id).emit('edited-message', editedMessage);
    } catch (error) {
      cb({ error })
    }
  })

  socket.on('delete-message', async ({ id, rid }, cb) => {
    try {
      const foundRoom = await getRoom(socket.user.id, rid);
      const deletedMessage = await deleteMessage(id)
      cb({ deletedMessageID: deletedMessage.id })
      socket.broadcast.to(foundRoom.id).emit('deleted-message', deletedMessage.id)
    } catch (error) {
      cb({ error })
    }
  })

  socket.on('new-friend-request', async (targetUsername, callback) => {
    try {
      const foundUser = await findUserByUsername(targetUsername);
      const { sender, receiver } = await createFriendRequest(socket.user.id, foundUser);
      callback(sender)
      const foundSocketID = getSocketID(foundUser.id)
      if (foundSocketID) {
        io.to(foundSocketID).emit("recieved-new-friend-request", receiver);
      }
    } catch (err) {
      console.log(err);
      callback(err)
    }
  })

  socket.on('update-friend-request', async (id, response, callback) => {
    try {
      const request = await updateFriendRequest(id, socket.user, response)
      const targetID = request?.targetID;
      if (targetID) {
        delete request.targetID;
      }
      callback(request?.sender || request);
      const foundSocketID = getSocketID(request?.sender?.user?.id || targetID);
      if (foundSocketID) {
        io.to(foundSocketID).emit("updated-friend-request", request?.receiver || request)
      }
    } catch (err) {
      callback(err)
    }
  })

  socket.on('idle', (status) => {
    broadcastUserStatusUpdate(status)
  })

  socket.on('disconnect', () => {
    broadcastUserStatusUpdate('offline')
  })

  socket.on('error', (error) => {
    console.error('Socket.IO server error: ', error)
  })
}