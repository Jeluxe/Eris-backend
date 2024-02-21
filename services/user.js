const { createHashedPassword } = require('../utils')
const User = require('../models/user.model')

const createUser = async (userDetails) => {
  try {
    delete userDetails.confirmPassword
    userDetails.password = createHashedPassword(userDetails.password)

    const newUser = new User(userDetails)

    return await newUser.save()
  } catch (error) {
    console.log('failed to create user: ', error);
  }
}

const findUser = async (userDetails) => {
  try {
    const user = await User.findOne({ email: userDetails.email, password: createHashedPassword(userDetails.password) },
      { email: 0, password: 0, updatedAt: 0, __v: 0 })

    return user
  } catch (error) {
    console.log('failed to find user: ', error)
  }
}

const findUserByUsername = async (username) => {
  try {
    const user = await User.findOne({ username },
      { email: 0, password: 0, updatedAt: 0, __v: 0 });

    return user;
  } catch (error) {
    console.log('failed to find user by username: ', error)
  }

}

const isUniqueValue = async (type, value) => {
  try {
    const valid = await User.findOne({ [type]: value })

    return valid ? true : false
  } catch (error) {
    console.error('failed to check if value is valid: ', error)
  }
}

module.exports = {
  createUser,
  findUser,
  findUserByUsername,
  isUniqueValue
}