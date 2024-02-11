const Friend = require('../models/friend.model');

const processFriendObject = async (friend) => {
  let populatedFriend = await Friend.populate(friend, 'sender receiver');
  populatedFriend = populatedFriend.toJSON()
  return populatedFriend;
}

const fetchFriendRequests = async (id) => {
  try {
    const friends = await Friend.find({ $or: [{ receiver: id }, { sender: id }] });

    if (friends.length > 0) {
      const processedFriends = await Promise.all(friends.map(async friend => {
        return await processFriendObject(friend);
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

      return await processFriendObject(friend)
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
        const friendRequest = await Friend.findByIdAndDelete({ _id });
        if (friendRequest) {
          const { sender, receiver } = friendRequest
          return {
            id: _id,
            status: "DECLINED",
            targetID: user.id !== sender ? sender : receiver,
          };
        }
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