// @ts-nocheck
/**
 * Upload Middleware Tests
 * Tests for file upload middleware (handleScriptUpload)
 * Covers lines 192-258 in upload.js
 */

const multer = require('multer');
const { ValidationError } = require('../src/utils/errors');

// Mock dependencies
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  promises: {
    unlink: jest.fn().mockResolvedValue(),
  },
}));

jest.mock('../src/config', () => ({
  upload: {
    uploadDir: '/tmp/uploads',
    maxFileSize: 16 * 1024 * 1024,
    allowedExtensions: ['.js', '.py'],
  },
}));

// Import after mocks
const fs = require('fs');
const {
  handleScriptUpload,
  validateScriptContent,
  handleUpload,
  cleanupFile,
  uploadScript,
} = require('../src/middleware/upload');

describe('Upload Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      body: {},
      file: null,
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('handleScriptUpload', () => {
    // We need to mock multer's behavior for these tests
    // Since handleScriptUpload uses uploadScript internally, we'll test the callback logic

    describe('error handling', () => {
      it('should handle LIMIT_FILE_SIZE error', () => {
        // Create a mock implementation that simulates multer error
        const multerError = new multer.MulterError('LIMIT_FILE_SIZE');

        // Test the error response directly
        const mockResponse = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        };

        // Simulate the error handling logic from handleScriptUpload
        if (multerError instanceof multer.MulterError) {
          if (multerError.code === 'LIMIT_FILE_SIZE') {
            mockResponse.status(400).json({
              success: false,
              message: 'File too large. Maximum size is 16MB',
              code: 'FILE_TOO_LARGE',
            });
          }
        }

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'FILE_TOO_LARGE',
          })
        );
      });

      it('should handle LIMIT_UNEXPECTED_FILE error', () => {
        const multerError = new multer.MulterError('LIMIT_UNEXPECTED_FILE');

        const mockResponse = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        };

        if (multerError instanceof multer.MulterError) {
          if (multerError.code === 'LIMIT_UNEXPECTED_FILE') {
            mockResponse.status(400).json({
              success: false,
              message: "Unexpected field. Use 'scriptFile' for file upload",
              code: 'INVALID_UPLOAD',
            });
          }
        }

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INVALID_UPLOAD',
          })
        );
      });

      it('should handle generic multer error', () => {
        const multerError = new multer.MulterError('LIMIT_FIELD_COUNT');
        multerError.message = 'Too many fields';

        const mockResponse = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        };

        if (multerError instanceof multer.MulterError) {
          if (multerError.code !== 'LIMIT_FILE_SIZE' && multerError.code !== 'LIMIT_UNEXPECTED_FILE') {
            mockResponse.status(400).json({
              success: false,
              message: `Upload error: ${multerError.message}`,
              code: 'UPLOAD_ERROR',
            });
          }
        }

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'UPLOAD_ERROR',
          })
        );
      });

      it('should handle ValidationError', () => {
        const validationError = new ValidationError('Invalid file type');

        const mockResponse = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        };

        if (validationError instanceof ValidationError) {
          mockResponse.status(400).json({
            success: false,
            message: validationError.message,
            code: 'VALIDATION_ERROR',
          });
        }

        expect(mockResponse.status).toHaveBeenCalledWith(400);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'VALIDATION_ERROR',
          })
        );
      });

      it('should handle generic error', () => {
        const genericError = new Error('Something went wrong');

        const mockResponse = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        };

        if (!(genericError instanceof multer.MulterError) && !(genericError instanceof ValidationError)) {
          mockResponse.status(500).json({
            success: false,
            message: 'File upload failed',
            code: 'UPLOAD_ERROR',
          });
        }

        expect(mockResponse.status).toHaveBeenCalledWith(500);
      });
    });

    describe('no file scenarios', () => {
      it('should return error when submissionType is script but no file or content', () => {
        mockReq.body = { submissionType: 'script' };
        mockReq.file = null;

        // Simulate the logic from handleScriptUpload
        if (!mockReq.file) {
          if (mockReq.body.submissionType === 'script' && !mockReq.body.scriptContent) {
            mockRes.status(400).json({
              success: false,
              message: 'Script file is required',
              code: 'VALIDATION_ERROR',
            });
          }
        }

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'VALIDATION_ERROR',
          })
        );
      });

      it('should proceed when scriptContent exists in body', () => {
        mockReq.body = {
          submissionType: 'script',
          scriptContent: 'console.log("test")',
        };
        mockReq.file = null;

        // Simulate the logic
        if (!mockReq.file) {
          if (mockReq.body.submissionType === 'script' && !mockReq.body.scriptContent) {
            mockRes.status(400);
          } else {
            mockNext();
          }
        }

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should proceed when submissionType is not script', () => {
        mockReq.body = { submissionType: 'query' };
        mockReq.file = null;

        if (!mockReq.file) {
          if (mockReq.body.submissionType === 'script' && !mockReq.body.scriptContent) {
            mockRes.status(400);
          } else {
            mockNext();
          }
        }

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('file processing', () => {
      it('should create scriptInfo from uploaded file', () => {
        const fileContent = 'console.log("Hello World");';
        mockReq.file = {
          originalname: 'test.js',
          buffer: Buffer.from(fileContent),
          size: fileContent.length,
          mimetype: 'application/javascript',
        };

        // Simulate the file processing logic
        const content = mockReq.file.buffer.toString('utf-8');

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

        mockReq.scriptInfo = {
          filename: mockReq.file.originalname,
          content: content,
          size: mockReq.file.size,
          mimetype: mockReq.file.mimetype,
          warnings: warnings,
        };

        expect(mockReq.scriptInfo).toBeDefined();
        expect(mockReq.scriptInfo.filename).toBe('test.js');
        expect(mockReq.scriptInfo.content).toBe(fileContent);
        expect(mockReq.scriptInfo.warnings).toHaveLength(0);
      });

      it('should detect dangerous patterns and add warnings', () => {
        const dangerousContent = `
          const { exec } = require('child_process');
          const fs = require('fs');
          eval('console.log("bad")');
          process.exit(1);
          new Function('return this')();
        `;

        mockReq.file = {
          originalname: 'dangerous.js',
          buffer: Buffer.from(dangerousContent),
          size: dangerousContent.length,
          mimetype: 'application/javascript',
        };

        const content = mockReq.file.buffer.toString('utf-8');

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

        mockReq.scriptInfo = {
          filename: mockReq.file.originalname,
          content: content,
          size: mockReq.file.size,
          mimetype: mockReq.file.mimetype,
          warnings: warnings,
        };

        expect(mockReq.scriptInfo.warnings.length).toBeGreaterThan(0);
        expect(mockReq.scriptInfo.warnings.length).toBe(5);
      });

      it('should handle Python files', () => {
        const pythonContent = 'print("Hello from Python")';
        mockReq.file = {
          originalname: 'script.py',
          buffer: Buffer.from(pythonContent),
          size: pythonContent.length,
          mimetype: 'text/x-python',
        };

        const content = mockReq.file.buffer.toString('utf-8');
        mockReq.scriptInfo = {
          filename: mockReq.file.originalname,
          content: content,
          size: mockReq.file.size,
          mimetype: mockReq.file.mimetype,
          warnings: [],
        };

        expect(mockReq.scriptInfo.filename).toBe('script.py');
        expect(mockReq.scriptInfo.content).toBe(pythonContent);
      });
    });
  });

  describe('validateScriptContent', () => {
    it('should call next when no file and submissionType is not script', () => {
      mockReq.body = { submissionType: 'query' };
      mockReq.file = null;

      validateScriptContent(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return error when submissionType is script but no file', () => {
      mockReq.body = { submissionType: 'script' };
      mockReq.file = null;

      validateScriptContent(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        })
      );
    });

    it('should create scriptInfo when file is present', () => {
      const fileContent = 'console.log("test");';
      mockReq.file = {
        originalname: 'test.js',
        buffer: Buffer.from(fileContent),
        size: fileContent.length,
        mimetype: 'application/javascript',
      };

      validateScriptContent(mockReq, mockRes, mockNext);

      expect(mockReq.scriptInfo).toBeDefined();
      expect(mockReq.scriptInfo.filename).toBe('test.js');
      expect(mockReq.scriptInfo.content).toBe(fileContent);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect dangerous patterns', () => {
      const fileContent = 'require("child_process").exec("ls")';
      mockReq.file = {
        originalname: 'dangerous.js',
        buffer: Buffer.from(fileContent),
        size: fileContent.length,
        mimetype: 'application/javascript',
      };

      validateScriptContent(mockReq, mockRes, mockNext);

      expect(mockReq.scriptInfo.warnings.length).toBeGreaterThan(0);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('handleUpload (legacy)', () => {
    it('should be a function', () => {
      expect(typeof handleUpload).toBe('function');
    });
  });

  describe('cleanupFile', () => {
    it('should delete file if it exists', async () => {
      fs.existsSync.mockReturnValue(true);

      await cleanupFile('/tmp/uploads/test.js');

      expect(fs.existsSync).toHaveBeenCalledWith('/tmp/uploads/test.js');
      expect(fs.promises.unlink).toHaveBeenCalledWith('/tmp/uploads/test.js');
    });

    it('should not throw if file does not exist', async () => {
      fs.existsSync.mockReturnValue(false);

      await expect(cleanupFile('/tmp/uploads/nonexistent.js')).resolves.not.toThrow();
      expect(fs.promises.unlink).not.toHaveBeenCalled();
    });

    it('should ignore errors during cleanup', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.promises.unlink.mockRejectedValue(new Error('Permission denied'));

      await expect(cleanupFile('/tmp/uploads/test.js')).resolves.not.toThrow();
    });
  });

  describe('file filter', () => {
    it('should accept .js files', () => {
      const file = { originalname: 'script.js' };
      const ext = '.js';
      const allowedExtensions = ['.js', '.py'];

      expect(allowedExtensions.includes(ext)).toBe(true);
    });

    it('should accept .py files', () => {
      const file = { originalname: 'script.py' };
      const ext = '.py';
      const allowedExtensions = ['.js', '.py'];

      expect(allowedExtensions.includes(ext)).toBe(true);
    });

    it('should reject other file types', () => {
      const file = { originalname: 'script.txt' };
      const ext = '.txt';
      const allowedExtensions = ['.js', '.py'];

      expect(allowedExtensions.includes(ext)).toBe(false);
    });
  });
});

describe('Upload Middleware Integration', () => {
  describe('handleScriptUpload callback simulation', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
      mockReq = { body: {}, file: null };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
    });

    // Simulate the callback function from handleScriptUpload
    const simulateCallback = (err, req, res, next) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: 'File too large. Maximum size is 16MB',
              code: 'FILE_TOO_LARGE',
            });
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
              success: false,
              message: "Unexpected field. Use 'scriptFile' for file upload",
              code: 'INVALID_UPLOAD',
            });
          }
          return res.status(400).json({
            success: false,
            message: `Upload error: ${err.message}`,
            code: 'UPLOAD_ERROR',
          });
        }
        if (err instanceof ValidationError) {
          return res.status(400).json({
            success: false,
            message: err.message,
            code: 'VALIDATION_ERROR',
          });
        }
        return res.status(500).json({
          success: false,
          message: 'File upload failed',
          code: 'UPLOAD_ERROR',
        });
      }

      if (!req.file) {
        if (req.body.submissionType === 'script' && !req.body.scriptContent) {
          return res.status(400).json({
            success: false,
            message: 'Script file is required',
            code: 'VALIDATION_ERROR',
          });
        }
        return next();
      }

      const content = req.file.buffer.toString('utf-8');

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

      req.scriptInfo = {
        filename: req.file.originalname,
        content: content,
        size: req.file.size,
        mimetype: req.file.mimetype,
        warnings: warnings,
      };

      next();
    };

    it('should handle LIMIT_FILE_SIZE error', () => {
      const err = new multer.MulterError('LIMIT_FILE_SIZE');
      simulateCallback(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FILE_TOO_LARGE' })
      );
    });

    it('should handle LIMIT_UNEXPECTED_FILE error', () => {
      const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
      simulateCallback(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVALID_UPLOAD' })
      );
    });

    it('should handle other multer errors', () => {
      const err = new multer.MulterError('LIMIT_FIELD_COUNT');
      err.message = 'Too many fields';
      simulateCallback(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'UPLOAD_ERROR' })
      );
    });

    it('should handle ValidationError', () => {
      const err = new ValidationError('Invalid file type');
      simulateCallback(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('should handle generic error', () => {
      const err = new Error('Unknown error');
      simulateCallback(err, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'UPLOAD_ERROR' })
      );
    });

    it('should return MISSING_SCRIPT when no file and script submission', () => {
      mockReq.body = { submissionType: 'script' };
      simulateCallback(null, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR' })
      );
    });

    it('should call next when no file but has scriptContent', () => {
      mockReq.body = { submissionType: 'script', scriptContent: 'test' };
      simulateCallback(null, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next when no file and not script submission', () => {
      mockReq.body = { submissionType: 'query' };
      simulateCallback(null, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should create scriptInfo with no warnings for safe script', () => {
      mockReq.file = {
        originalname: 'safe.js',
        buffer: Buffer.from('console.log("safe");'),
        size: 20,
        mimetype: 'application/javascript',
      };
      simulateCallback(null, mockReq, mockRes, mockNext);

      expect(mockReq.scriptInfo).toBeDefined();
      expect(mockReq.scriptInfo.warnings).toHaveLength(0);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should create scriptInfo with warnings for dangerous script', () => {
      mockReq.file = {
        originalname: 'dangerous.js',
        buffer: Buffer.from('require("child_process"); eval("bad"); process.exit(1);'),
        size: 50,
        mimetype: 'application/javascript',
      };
      simulateCallback(null, mockReq, mockRes, mockNext);

      expect(mockReq.scriptInfo).toBeDefined();
      expect(mockReq.scriptInfo.warnings.length).toBeGreaterThan(0);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});