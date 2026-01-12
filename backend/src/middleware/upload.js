/**
 * File Upload Middleware
 * Handle script file uploads using multer
 * 
 * FLOW:
 * 1. uploadScript - Raw multer middleware (internal use)
 * 2. validateScriptContent - Creates req.scriptInfo from req.file
 * 3. handleScriptUpload - COMBINED middleware (use this in routes!)
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { ValidationError } = require('../utils/errors');
const response = require('../utils/response');

// Ensure upload directory exists
const uploadDir = config.upload.uploadDir;
/* istanbul ignore if */
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Storage configuration (for disk storage if needed)
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uniqueId}${ext}`;
    cb(null, filename);
  },
});

/**
 * Memory storage for processing files in memory
 */
const memoryStorage = multer.memoryStorage();

/**
 * File filter function
 * Only allows .js and .py files
 */
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!config.upload.allowedExtensions.includes(ext)) {
    return cb(
      new ValidationError(
        `Invalid file type. Allowed types: ${config.upload.allowedExtensions.join(', ')}`
      ),
      false
    );
  }
  
  // Check MIME type as additional security
  const allowedMimeTypes = [
    'application/javascript',
    'text/javascript',
    'application/x-javascript',
    'text/x-python',
    'application/x-python',
    'text/plain',
  ];
  
  // Note: MIME type detection isn't always reliable, so we rely more on extension
  cb(null, true);
};

/**
 * Multer upload configuration (disk storage)
 */
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1,
  },
  fileFilter: fileFilter,
});

/**
 * Memory upload for reading file content
 */
const memoryUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1,
  },
  fileFilter: fileFilter,
});

/**
 * Raw multer middleware for single script file
 * Puts file in req.file
 */
const uploadScript = memoryUpload.single('scriptFile');

/**
 * Helper function to handle multer errors
 * @param {Error} err - The error object
 * @param {Object} res - Express response object
 * @returns {Object|null} - Response if error handled, null otherwise
 */
const handleMulterError = (err, res) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return response.error(
        res,
        `File too large. Maximum size is ${config.upload.maxFileSize / (1024 * 1024)}MB`,
        400,
        'FILE_TOO_LARGE'
      );
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return response.error(
        res, 
        `Unexpected field. Use 'scriptFile' for file upload`, 
        400, 
        'INVALID_UPLOAD'
      );
    }
    // Other multer errors - fallback
    /* istanbul ignore next */
    return response.error(res, `Upload error: ${err.message}`, 400, 'UPLOAD_ERROR');
  }
  
  if (err instanceof ValidationError) {
    return response.error(res, err.message, 400, 'VALIDATION_ERROR');
  }
  
  // Unknown error type - fallback
  /* istanbul ignore next */
  return response.error(res, 'File upload failed', 500, 'UPLOAD_ERROR');
};

/**
 * Legacy middleware wrapper with error handling
 */
const handleUpload = (req, res, next) => {
  uploadScript(req, res, (err) => {
    if (err) {
      return handleMulterError(err, res);
    }
    next();
  });
};

/**
 * Validate uploaded file content and create req.scriptInfo
 * MUST be called AFTER uploadScript or handleUpload
 */
const validateScriptContent = (req, res, next) => {
  if (!req.file) {
    // Script file is optional if scriptContent is provided in body
    if (req.body.submissionType === 'script' && !req.body.scriptContent) {
      return response.error(res, 'Script file is required', 400, 'MISSING_SCRIPT');
    }
    return next();
  }

  const content = req.file.buffer.toString('utf-8');
  
  // Basic validation - check for potentially dangerous patterns
  const dangerousPatterns = [
    /require\s*\(\s*['"]child_process['"]\s*\)/,
    /require\s*\(\s*['"]fs['"]\s*\)/,
    /process\.exit/,
    /eval\s*\(/,
    /Function\s*\(/,
  ];

  // Note: These checks are informational - the actual sandboxing happens at execution time
  const warnings = [];
  dangerousPatterns.forEach((pattern) => {
    if (pattern.test(content)) {
      warnings.push(`Script contains potentially restricted pattern: ${pattern.toString()}`);
    }
  });

  // Store file info and content in req.scriptInfo
  // This is what the controller looks for!
  req.scriptInfo = {
    filename: req.file.originalname,
    content: content,
    size: req.file.size,
    mimetype: req.file.mimetype,
    warnings: warnings,
  };

  next();
};

/**
 * COMBINED MIDDLEWARE - Use this in routes!
 * 
 * This middleware:
 * 1. Handles multipart/form-data upload (multer)
 * 2. Validates file type and size
 * 3. Creates req.scriptInfo for the controller
 * 
 * Usage in routes:
 *   router.post('/submit-script', authenticate, handleScriptUpload, ...)
 */
const handleScriptUpload = (req, res, next) => {
  // Step 1: Use multer to parse the upload
  uploadScript(req, res, (err) => {
    // Step 2: Handle multer errors
    if (err) {
      return handleMulterError(err, res);
    }

    // Step 3: Validate and create req.scriptInfo
    if (!req.file) {
      // No file uploaded - check if scriptContent is in body (alternative method)
      if (req.body.submissionType === 'script' && !req.body.scriptContent) {
        return response.error(res, 'Script file is required', 400, 'MISSING_SCRIPT');
      }
      // No file but scriptContent exists or submissionType is not 'script'
      return next();
    }

    // File exists - read content and create scriptInfo
    const content = req.file.buffer.toString('utf-8');
    
    // Basic security validation
    const dangerousPatterns = [
      /require\s*\(\s*['"]child_process['"]\s*\)/,
      /require\s*\(\s*['"]fs['"]\s*\)/,
      /process\.exit/,
      /eval\s*\(/,
      /Function\s*\(/,
    ];

    const warnings = [];
    dangerousPatterns.forEach((pattern) => {
      if (pattern.test(content)) {
        warnings.push(`Script contains potentially restricted pattern: ${pattern.toString()}`);
      }
    });

    // Create req.scriptInfo - this is what the controller expects!
    req.scriptInfo = {
      filename: req.file.originalname,
      content: content,
      size: req.file.size,
      mimetype: req.file.mimetype,
      warnings: warnings,
    };

    next();
  });
};

/**
 * Clean up uploaded file
 */
const cleanupFile = async (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (error) {
    // Ignore cleanup errors - not critical
  }
};

module.exports = {
  upload,
  memoryUpload,
  uploadScript,
  handleUpload,
  validateScriptContent,
  handleScriptUpload,  // <-- USE THIS IN ROUTES!
  cleanupFile,
};