const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  position: {
    type: String,
    required: [true, 'Position is required'],
    trim: true,
    maxlength: [200, 'Position cannot exceed 200 characters']
  },
  coverLetter: {
    type: String,
    required: [true, 'Cover letter is required'],
    trim: true,
    maxlength: [2000, 'Cover letter cannot exceed 2000 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'accepted', 'rejected'],
    default: 'pending'
  },
  appliedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
applicationSchema.index({ applicant: 1, createdAt: -1 });
applicationSchema.index({ job: 1, status: 1 });
applicationSchema.index({ status: 1, createdAt: -1 });

// Prevent duplicate applications for same job
applicationSchema.index({ applicant: 1, job: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);