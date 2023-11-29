const Message = require('../models/message.model');
const { getRoom, createRoom } = require('./rooms');

const fetchMessages = async (id, toID) => {
  try {
    const room = await getRoom(id, toID);
    const messages = await Message.find({ rid: room.id }).populate("sender")
    return messages;
  } catch (error) {
    console.error('fetch-messages failed: ' + error)
  }
}

const saveMessageToDatabase = async (userID, messageInfo) => {
  try {
    let room = await getRoom(userID, messageInfo.rid);

    if (!room) {
      room = await createRoom(userID, messageInfo.rid)
    }

    messageInfo = {
      sender: userID,
      ...messageInfo,
      rid: room.id,
    }

    const newMessage = new Message(messageInfo);
    const message = await newMessage.save()
    return await message.populate('sender')
  } catch (error) {
    console.error("add message to DB failed: " + error);
  }
}

module.exports = {
  fetchMessages,
  saveMessageToDatabase
}