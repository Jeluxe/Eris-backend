const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  rid: { type: String, required: true },
  content: {
    type: Schema.Types.Mixed,
    validate: {
      validator: function (value) {
        return typeof value === 'string' || Buffer.isBuffer(value);
      },
      message: props => `${props.value} must be a String or Buffer!`
    },
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: { type: Number, required: true },
  edited: { type: Boolean, required: true, default: false },
  timestamp: { type: String, required: true },
  edited_timestamp: { type: String },
});

messageSchema.set("toJSON", {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  },
});

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;