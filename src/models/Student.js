const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  studentCode: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30,
  },

  fullName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150,
  },

  section: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },

  courseCode: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30,
  },

  courseName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150,
  },

  qrToken: {
    type: String,
    required: true,
    unique: true,
    select: false,
  },

  attendance: {
    type: Map,
    of: {
      type: String,
      enum: ["present", "absent"],
    },
    default: {},
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// A student can enroll in different courses,
// but cannot be enrolled twice in the same course.
studentSchema.index({ studentCode: 1, courseCode: 1 }, { unique: true });

module.exports = mongoose.model("Student", studentSchema);
