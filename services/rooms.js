const Room = require("../models/room.model");

const createRoom = async (userID, recipients) => {
  let newRoom = new Room({
    type: typeof recipients !== "string" && recipients.length > 0 ? 1 : 0,
    recipients: typeof recipients !== "string" && recipients.length > 0 ? [userID, ...recipients] : [userID, recipients]
  })
  try {
    newRoom = await newRoom.save()
    const populatedRoom = await newRoom.populate("recipients");

    return populatedRoom
  } catch (error) {
    console.error('failed to create room: ', error)
    return error
  }
}

const getRoom = async (userID, _id) => {
  try {
    return await Room.findOne({ _id, recipients: { $in: [userID] } })
  } catch (error) {
    console.error('failed to fetch room: ', error)
    return error
  }
}

const fetchRooms = async (id) => {
  try {
    let foundRooms = await Room.find({
      recipients: { $all: [id] },
    }).populate("recipients");

    const processedRooms = await processRooms(foundRooms, id)

    return processedRooms;
  } catch (error) {
    console.error('failed to fetch rooms: ', error)
    return error
  }
};

const processRooms = async (rooms, id) => {
  return rooms.map(room => {
    room = room.toJSON()

    let proccessedRoom = {
      ...room,
      recipients: room.type === 0 ? room.recipients[0].id !== id ? room.recipients[0] : room.recipients[1] : room.recipients
    }
    delete proccessedRoom.created_at
    delete proccessedRoom.updatedAt

    return proccessedRoom
  })
};

module.exports = {
  createRoom,
  getRoom,
  fetchRooms,
}