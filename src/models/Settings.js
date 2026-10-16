const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
  courseCode: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 30,
  },

  semesterName: {
    type: String,
    default: "الترم الحالي",
  },

  totalWeeks: {
    type: Number,
    required: true,
    min: 1,
    max: 30,
    default: 14,
  },

  currentWeek: {
    type: Number,
    default: 1,
    min: 1,
    max: 30,
  },

  closedWeeks: {
    type: [Number],
    default: [],
  },
});

module.exports = mongoose.model("Settings", settingsSchema);
