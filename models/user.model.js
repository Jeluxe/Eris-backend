const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    username: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true },
    avatar: String,
  },
  { timestamps: { createdAt: "created_at" } }
);

userSchema.set("toJSON", {
  transform: (document, returnObject) => {
    returnObject.id = returnObject._id.toString();
    delete returnObject.email;
    delete returnObject._id;
    delete returnObject.__v;
    delete returnObject.password;
  },
});
const User = mongoose.model("User", userSchema);
module.exports = User;

