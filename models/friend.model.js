const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const friendSchema = new Schema({
  sender: { type: String, ref: "User", required: true },
  receiver: { type: String, ref: "User", required: true },
  status: {
    type: String,
    enum: ["PENDING", "ACCEPTED", "BLOCKED"],
    default: "PENDING",
    required: true
  },
});

friendSchema.set("toJSON", {
  transform: (document, returnedObj) => {
    returnedObj.id = returnedObj._id.toString();
    delete returnedObj._id;
    delete returnedObj.__v;
  },
});

const Friend = mongoose.model("Friend", friendSchema);
module.exports = Friend;