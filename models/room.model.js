const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const roomSchema = new Schema(
  {
    type: { type: Number, required: true },
    owner_id: String,
    recipients: [
      {
        type: String,
        ref: "User",
        required: true,
        minlength: 2
      },
    ],
  },
  { timestamps: { createdAt: "created_at" } }
);

roomSchema.set("toJSON", {
  transform: (document, returnObject) => {
    returnObject.id = returnObject._id.toString();
    delete returnObject._id;
    delete returnObject.__v;
  },
});

const Room = mongoose.model("Room", roomSchema);
module.exports = Room;
