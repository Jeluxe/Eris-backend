const Friend = require('../models/friend.model');

const processFriendObject = async (userID, friend, both) => {
  let populatedFriend = await Friend.populate(friend, 'sender receiver');
  populatedFriend = populatedFriend.toJSON()

  const isSender = userID === populatedFriend.sender.id

  const sender = { ...populatedFriend, user: isSender ? populatedFriend.receiver : populatedFriend.sender, isSender }
  const receiver = { ...populatedFriend, user: both ? isSender ? populatedFriend.sender : populatedFriend.receiver : !isSender ? populatedFriend.sender : populatedFriend.receiver, isSender: both ? !isSender : isSender }

  delete sender.sender
  delete sender.receiver
  delete receiver.sender
  delete receiver.receiver

  return both ? { sender, receiver } : isSender ? sender : receiver;
}

const fetchFriendRequests = async (id) => {
  try {
    const friends = await Friend.find({ $or: [{ receiver: id }, { sender: id }] });

    if (friends.length > 0) {
      const processedFriends = await Promise.all(friends.map(async friend => {
        return await processFriendObject(id, friend, false);
      }));

      return processedFriends
    } else {
      console.log('No friends found.');
    }
  } catch (error) {
    console.error('find friends requests failed: ', error)
  }
}

const createFriendRequest = async (userID, receiver) => {
  try {
    if (!receiver) throw "no such username, please consider case sensitive."

    const validateSameUser = userID === receiver.id;

    if (validateSameUser) throw "cannot be send to yourself"

    const friendRequestExists = await Friend.findOne({ $or: [{ sender: userID, receiver: receiver.id }, { sender: receiver.id, receiver: userID }] });

    if (!friendRequestExists) {
      const newFriendRequest = new Friend({ sender: userID, receiver: receiver.id });
      const friend = await newFriendRequest.save()

      return await processFriendObject(userID, friend, true)
    }
    throw 'friend request already exists'
  } catch (error) {
    console.error('friend-creation request failed: ', error)
    return { type: 'error', message: error }
  }
}

const updateDocument = async (_id, status) => {
  return await Friend.findByIdAndUpdate({ _id }, { status }, { new: true })
}

const updateFriendRequest = async (_id, userID, response) => {
  try {
    switch (response) {
      case "decline":
        const friendRequest = await Friend.findByIdAndDelete({ _id });
        if (friendRequest) {
          const { sender, receiver } = friendRequest
          return {
            id: _id,
            status: "DECLINED",
            targetID: userID !== sender ? sender : receiver,
          };
        }
      case "block":
        const blockedFriendRequest = await updateDocument(_id, "BLOCKED");
        return processFriendObject(userID, blockedFriendRequest, true);
      case "accept":
      case "restore":
        const updatedFriendRequest = await updateDocument(_id, "ACCEPTED");
        return processFriendObject(userID, updatedFriendRequest, true);
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