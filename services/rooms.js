const Room = require("../models/room.model");

const createRoom = async (userID, targetID) => {
  let newRoom = new Room({
    type: 0,
    recipients: [userID, targetID]
  })

  try {
    newRoom = await newRoom.save()
    const populatedRoom = await newRoom.populate("recipients");

    return populatedRoom
  } catch (error) {
    console.error('failed to create room: ', error)
  }
}

const getRoom = async (userID, targetID) => {
  try {
    const room = await Room.findOne({
      recipients: { $all: [userID, targetID] }
    });

    return room
  } catch (error) {
    console.error('failed to fetch room: ', error)
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
  }
};

const processRooms = async (rooms, id) => {
  return rooms.map(room => {
    room = room.toJSON()

    let obj = {
      ...room,
      user: room.recipients[0].id !== id ? room.recipients[0] : room.recipients[1]
    }
    delete obj.recipients
    delete obj.created_at
    delete obj.updatedAt

    return obj
  })
};

module.exports = {
  createRoom,
  getRoom,
  fetchRooms,
}