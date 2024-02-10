const Friend = require('../models/friend.model');
const { findUserByUsername } = require('./user');

const porcessFriendObject = async (friend, isSender) => {
  let populatedFriend = await Friend.populate(friend, {
    path: isSender ? 'receiver' : 'sender',
  });

  populatedFriend = populatedFriend.toJSON()

  const processedFriend = {
    ...populatedFriend,
    user: isSender ? populatedFriend.receiver : populatedFriend.sender,
    isSender
  };

  delete processedFriend.receiver;
  delete processedFriend.sender;

  return processedFriend;
}

const fetchFriendRequests = async (id) => {
  try {
    const friends = await Friend.find({ $or: [{ receiver: id }, { sender: id }] });

    if (friends.length > 0) {
      const processedFriends = await Promise.all(friends.map(async friend => {

        const isSender = friend.sender === id

        return await porcessFriendObject(friend, isSender);
      }));

      return processedFriends
    } else {
      console.log('No friends found.');
    }
  } catch (error) {
    console.error('find friends requests failed: ', error)
  }
}

const createFriendRequest = async (user, receiver) => {
  try {
    if (!receiver) throw "no such username, please consider case sensitive."

    const validateSameUser = user.id === receiver.id;

    if (validateSameUser) throw "cannot be send to yourself"

    const friendRequestExists = await Friend.findOne({ $or: [{ sender: user.id, receiver: receiver.id }, { sender: receiver.id, receiver: user.id }] });

    if (!friendRequestExists) {
      const newFriendRequest = new Friend({ sender: user.id, receiver: receiver.id });
      const friend = await newFriendRequest.save()

      return await porcessFriendObject(friend, true)
    }
    throw 'friend request already exists'
  } catch (error) {
    console.error('friend-creation request failed: ', error)
    return { type: 'error', message: error }
  }
}

const updateFriendRequest = async (_id, user, response) => {
  try {
    switch (response) {
      case "decline":
        const { sender, receiver } = await Friend.findByIdAndDelete({ _id });
        return {
          id: _id,
          status: "deleted",
          targetID: user.id === sender.id ? sender.id : receiver.id,
        };
      case "block":
        const BlockedFriendRequest = await Friend.findByIdAndUpdate({ _id }, { status: "BLOCKED" });
        return BlockedFriendRequest;
      case "accept":
      case "restore":
        const updatedFriendRequest = await Friend.findOneAndUpdate({ _id }, { status: 'ACCEPTED' })
        return updatedFriendRequest;
      default:
        throw new Error("failed to update the request")
    }
  } catch (error) {
    console.log("friend-request failed to update: ", error)
  }
}

module.exports = {
  fetchFriendRequests,
  createFriendRequest,
  updateFriendRequest
}