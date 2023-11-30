const Friend = require('../models/friend.model');
const { findUserByUsername } = require('./user');


const fetchFriendRequests = async (id) => {
  try {
    const friends = await Friend.find({ $or: [{ receiver: id }, { sender: id }] });

    if (friends.length > 0) {
      const processedFriends = await Promise.all(friends.map(async friend => {

        const isSender = friend.sender.id === id

        let populatedFriend = await Friend.populate(friend, {
          path: !isSender ? 'receiver' : 'sender',
        });

        populatedFriend = populatedFriend.toJSON()

        const user = {
          ...populatedFriend,
          user: !isSender ? populatedFriend.receiver : populatedFriend.sender,
        };

        delete user.receiver;
        delete user.sender;

        return user;
      }));

      return processedFriends
    } else {
      console.log('No friends found.');
    }
  } catch (error) {
    console.error('find friends requests failed: ', error)
  }
}

const createFriendRequest = async (user, targetUsername) => {
  try {
    const reciever = await findUserByUsername(targetUsername);

    if (!reciever) throw "no such username, please consider case sensitive."

    const validateSameUser = user.id === reciever.id;

    if (validateSameUser) throw "cannot be send to yourself"

    const friendRequestExists = await Friend.findOne({ $or: [{ sender: user.id, reciever: reciever.id }, { sender: reciever.id, reciever: user.id }] })
    const isSender = friendRequestExists.sender.equals(user.id)
    const populated = await friendRequestExists.populate(isSender ? 'receiver' : 'sender').execPopulate();
    const friendRequest = {
      ...populated.toJSON(),
      user: isSender ? populated.receiver : populated.sender
    }
    if (!friendRequest) {
      const newFriendRequest = new Friend({ sender: user.id, reciever: reciever.id });
      return await newFriendRequest.save()
    }
    return friendRequest
  } catch (error) {
    console.error('friend-creation request failed: ', error)
    return { type: 'error', message: error }
  }
}

module.exports = {
  fetchFriendRequests,
  createFriendRequest
}