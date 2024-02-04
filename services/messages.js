const Message = require('../models/message.model');
const { getRoom, createRoom } = require('./rooms');

const fetchMessages = async (rid) => {
  try {
    const messages = await Message.find({ rid }).populate("sender");
    return messages;
  } catch (error) {
    console.error('fetch-messages failed: ' + error)
    return error
  }
}

const addMessage = async (userID, messageInfo) => {
  try {
    let room = await getRoom(userID, messageInfo.rid);
    if (!room) {
      room = await createRoom(userID, [messageInfo.rid])
    }

    messageInfo = {
      sender: userID,
      rid: room.id,
      edited: false,
      ...messageInfo,
      edited_timestamp: null
    }

    const newMessage = new Message(messageInfo);
    const message = await newMessage.save()
    return await message.populate('sender')
  } catch (error) {
    console.error("add message to DB failed: " + error);
    return error
  }
}

const editMessage = async (_id, newContent) => {
  try {
    return await Message.findByIdAndUpdate({ _id }, { content: newContent, edited: true, edited_timestamp: Date.now() }, { new: true }).populate("sender");
  } catch (error) {
    console.log(c)
    return error
  }
}

const deleteMessage = async (_id) => {
  return await Message.findByIdAndDelete({ _id })
}

module.exports = {
  fetchMessages,
  addMessage,
  editMessage,
  deleteMessage
}