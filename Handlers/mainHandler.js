const { saveMessageToDatabase } = require('../services/messages');
const { createFriendRequest, updateFriendRequest } = require('../services/friend');
const { users } = require('../constants')
const { getUsers } = require('../utils');

module.exports = async (io, socket) => {
  for (let [id, clientSocket] of io.of("/").sockets) {
    if (!users.find(user => user.id === clientSocket.user.id)) {
      users.push({
        ...clientSocket.user,
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

  socket.on('update-friend-request', async (id, response, callback) => {
    const request = await updateFriendRequest(id, response)
    callback(request)
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