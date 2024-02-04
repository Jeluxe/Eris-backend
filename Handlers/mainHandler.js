const { addMessage, editMessage, deleteMessage } = require('../services/messages');
const { createFriendRequest, updateFriendRequest } = require('../services/friend');
const { users } = require('../constants');
const { getUsers, getSocketID } = require('../utils');
const { getRoom, createRoom } = require('../services/rooms');
const { findUserByUsername } = require('../services/user');

module.exports = async (io, socket) => {
  for (let [id, socketClient] of io.of("/").sockets) {
    if (!users.find(user => user.id === socketClient.user.id)) {
      users.push({
        ...socketClient.user,
        socketID: id,
        status: "online",
      });
    }
  }
  console.log('main socket on!')
  const rooms = await getUsers(users, socket.user.id)

  const broadcastUserStatusUpdate = (status) => {
    socket.to(rooms?.map(({ rid }) => rid.toString())).emit('user-connected', socket.user.id, status)
  }

  rooms.forEach(({ rid }) => socket.join(rid.toString()))

  broadcastUserStatusUpdate('online')

  socket.on('message', async (message, cb) => {
    try {
      let newMessage = await addMessage(socket.user.id, message)

      if (!socket.rooms.has(newMessage.rid)) {
        socket.join(newMessage.rid)
      }
      if (newMessage.type === 2) {
        const base64Content = newMessage.content.toString('base64');
        newMessage.content = base64Content;
      }

      io.to(newMessage.rid).emit('message', newMessage)
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
      io.to(foundRoom.id).emit('edited-message', editedMessage);
    } catch (error) {
      cb({ error })
    }
  })

  socket.on('delete-message', async ({ id, rid }, cb) => {
    try {
      const foundRoom = await getRoom(socket.user.id, rid);
      const deletedMessage = await deleteMessage(id)
      io.to(foundRoom.id).emit('deleted-message', deletedMessage.id)
    } catch (err) {
      cb(err)
    }
  })

  socket.on('new-friend-request', async (targetUsername, callback) => {
    try {
      const receiver = await findUserByUsername(targetUsername);
      const request = await createFriendRequest(socket.user, receiver)
      callback(request)
      socket.to(getSocketID(receiver.id)).emit("new-friend-request", request)
    } catch (err) {
      console.log(err);
      callback(err)
    }
  })

  socket.on('update-friend-request', async (id, response, callback) => {
    try {
      const request = await updateFriendRequest(id, socket.user, response)
      const targetID = request.targetID;
      delete request.targetID;
      socket.to(getSocketID(targetID)).emit("update-friend-request", request)
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