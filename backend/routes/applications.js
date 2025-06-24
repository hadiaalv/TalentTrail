const express = require('express');
const Application = require('../models/Application');
const Job = require('../models/Job');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware for applications
const validateApplication = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('position')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Position must be between 2 and 200 characters'),
  body('coverLetter')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Cover letter must be between 10 and 2000 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];

// Submit job application
router.post('/', authenticateToken, requireRole(['student']), validateApplication, async (req, res) => {
  try {
    const { jobId, fullName, email, position, coverLetter } = req.body;

    // Check if job exists and is active
    const job = await Job.findById(jobId);
    if (!job || !job.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or no longer active'
      });
    }

    if (job.deadline <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Application deadline has passed'
      });
    }

    // Check if user already applied
    const existingApplication = await Application.findOne({
      applicant: req.user._id,
      job: jobId
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this job'
      });
    }

    // Create application
    const application = new Application({
      applicant: req.user._id,
      job: jobId,
      fullName,
      email,
      position,
      coverLetter
    });

    await application.save();

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: { application }
    });
  } catch (error) {
    console.error('Submit application error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get user's applications (students only)
router.get('/my-applications', authenticateToken, requireRole(['student']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const applications = await Application.find({ applicant: req.user._id })
      .populate('job', 'title company jobType location deadline')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Application.countDocuments({ applicant: req.user._id });

    res.json({
      success: true,
      data: {
        applications,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get my applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get applications for employer's jobs
router.get('/job/:jobId', authenticateToken, requireRole(['employer']), async (req, res) => {
  try {
    const { jobId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Verify job belongs to employer
    const job = await Job.findOne({ _id: jobId, postedBy: req.user._id });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or you do not have permission to view applications'
      });
    }

    const applications = await Application.find({ job: jobId })
      .populate('applicant', 'fullname email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Application.countDocuments({ job: jobId });

    res.json({
      success: true,
      data: {
        applications,
        job: {
          title: job.title,
          company: job.company
        },
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job applications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update application status (employers only)
router.patch('/:id/status', authenticateToken, requireRole(['employer']), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'reviewed', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const application = await Application.findById(req.params.id)
      .populate('job', 'postedBy title company');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Verify job belongs to employer
    if (application.job.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this application'
      });
    }

    application.status = status;
    await application.save();

    res.json({
      success: true,
      message: 'Application status updated successfully',
      data: { application }
    });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update application status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;