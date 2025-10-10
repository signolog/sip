// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // allows null values
    },
    role: {
      type: String,
      enum: ["admin", "place_owner", "store_owner"],
      required: true,
    },

    // Role-specific fields
    place_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Place",
    },
    store_id: {
      type: String, // room-157 format
    },

    last_login: {
      type: Date,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Password hashing middleware
UserSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Password comparison method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
