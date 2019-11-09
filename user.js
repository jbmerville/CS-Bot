const mongoose = require("mongoose");
const Schema = mongoose.Schema;

var userSchema = new Schema({
  userId: Number,
  name: String,
  profile: String,
  found: Boolean,
  canBeContacted: Boolean,
  hasProject: Boolean,
  aboutUser: String,
  step: Number
});


module.exports = mongoose.model("User", userSchema);
