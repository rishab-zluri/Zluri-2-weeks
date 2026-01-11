/**
 * Upload Middleware Integration Tests
 * 
 * These tests make actual HTTP requests to trigger the multer callback
 * and cover lines 197, 212, 217 in upload.js
 * 
 * IMPORTANT: Config sets maxFileSize to 1000 bytes (1KB) in test environment
 * This allows testing the LIMIT_FILE_SIZE error (Line 197)
 */

const express = require('express');
const request = require('supertest');
const path = require('path');

// Import the actual middleware - this uses config.upload.maxFileSize which is 1KB in tests
const { handleScriptUpload, validateScriptContent, cleanupFile } = require('../src/middleware/upload');

describe('Upload Middleware Integration Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('handleScriptUpload - Error Handling', () => {
    beforeEach(() => {
      // Setup route that uses handleScriptUpload
      app.post('/upload', handleScriptUpload, (req, res) => {
        res.json({
          success: true,
          scriptInfo: req.scriptInfo || null,
        });
      });
    });

    // LINE 197: LIMIT_FILE_SIZE error
    // Config sets maxFileSize to 1000 bytes in test environment
    describe('Line 197: LIMIT_FILE_SIZE error', () => {
      it('should reject files exceeding 1KB size limit', async () => {
        // Create content larger than 1000 bytes (1KB limit in test env)
        const largeContent = 'x'.repeat(2000);
        
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from(largeContent), 'large.js');

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('FILE_TOO_LARGE');
        expect(response.body.message).toContain('File too large');
      });

      it('should accept files within size limit', async () => {
        // Create content smaller than 1000 bytes
        const smallContent = 'console.log("ok");';
        
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from(smallContent), 'small.js');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should reject file exactly at boundary', async () => {
        // Create content exactly at 1001 bytes (just over limit)
        const boundaryContent = 'x'.repeat(1001);
        
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from(boundaryContent), 'boundary.js');

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('FILE_TOO_LARGE');
      });
    });

    // LINE 212: LIMIT_UNEXPECTED_FILE error
    describe('Line 212: LIMIT_UNEXPECTED_FILE error', () => {
      it('should handle wrong field name', async () => {
        const response = await request(app)
          .post('/upload')
          .attach('wrongFieldName', Buffer.from('test content'), 'test.js');

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('INVALID_UPLOAD');
        expect(response.body.message).toContain('Unexpected field');
      });

      it('should reject field name "file" instead of "scriptFile"', async () => {
        const response = await request(app)
          .post('/upload')
          .attach('file', Buffer.from('test'), 'test.js');

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('INVALID_UPLOAD');
      });

      it('should reject field name "upload"', async () => {
        const response = await request(app)
          .post('/upload')
          .attach('upload', Buffer.from('test'), 'test.js');

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('INVALID_UPLOAD');
      });
    });

    // LINE 217: ValidationError for invalid file type
    describe('Line 217: ValidationError for invalid file type', () => {
      it('should reject .txt files', async () => {
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from('test content'), 'test.txt');

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('VALIDATION_ERROR');
        expect(response.body.message).toContain('Invalid file type');
      });

      it('should reject .exe files', async () => {
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from('test'), 'virus.exe');

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('VALIDATION_ERROR');
      });

      it('should reject .sh files', async () => {
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from('#!/bin/bash'), 'script.sh');

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('VALIDATION_ERROR');
      });

      it('should reject .php files', async () => {
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from('<?php ?>'), 'script.php');

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('VALIDATION_ERROR');
      });

      it('should reject files with no extension', async () => {
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from('test'), 'noextension');

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('VALIDATION_ERROR');
      });
    });

    // Successful uploads
    describe('Successful uploads', () => {
      it('should process valid JavaScript file successfully', async () => {
        const jsContent = 'console.log("Hello World");';
        
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from(jsContent), 'test.js');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.scriptInfo).toBeDefined();
        expect(response.body.scriptInfo.filename).toBe('test.js');
        expect(response.body.scriptInfo.content).toBe(jsContent);
        expect(response.body.scriptInfo.warnings).toHaveLength(0);
      });

      it('should process valid Python file successfully', async () => {
        const pyContent = 'print("Hello World")';
        
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from(pyContent), 'test.py');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.scriptInfo).toBeDefined();
        expect(response.body.scriptInfo.filename).toBe('test.py');
      });

      it('should include file metadata in scriptInfo', async () => {
        const content = 'const x = 1;';
        
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from(content), 'meta.js');

        expect(response.status).toBe(200);
        expect(response.body.scriptInfo.size).toBe(content.length);
        expect(response.body.scriptInfo.mimetype).toBeDefined();
      });
    });

    // Dangerous pattern detection
    describe('Dangerous pattern detection', () => {
      it('should detect child_process pattern and add warning', async () => {
        const dangerousContent = 'require("child_process").exec("ls")';
        
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from(dangerousContent), 'dangerous.js');

        expect(response.status).toBe(200);
        expect(response.body.scriptInfo.warnings.length).toBeGreaterThan(0);
        expect(response.body.scriptInfo.warnings[0]).toContain('child_process');
      });

      it('should detect fs pattern and add warning', async () => {
        const dangerousContent = 'require("fs").readFileSync("test")';
        
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from(dangerousContent), 'dangerous.js');

        expect(response.status).toBe(200);
        expect(response.body.scriptInfo.warnings.length).toBeGreaterThan(0);
      });

      it('should detect eval pattern and add warning', async () => {
        const dangerousContent = 'eval("console.log(1)")';
        
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from(dangerousContent), 'dangerous.js');

        expect(response.status).toBe(200);
        expect(response.body.scriptInfo.warnings.length).toBeGreaterThan(0);
      });

      it('should detect process.exit pattern and add warning', async () => {
        const dangerousContent = 'process.exit(1)';
        
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from(dangerousContent), 'dangerous.js');

        expect(response.status).toBe(200);
        expect(response.body.scriptInfo.warnings.length).toBeGreaterThan(0);
      });

      it('should detect Function constructor pattern and add warning', async () => {
        const dangerousContent = 'new Function("return this")()';
        
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from(dangerousContent), 'dangerous.js');

        expect(response.status).toBe(200);
        expect(response.body.scriptInfo.warnings.length).toBeGreaterThan(0);
      });

      it('should detect all dangerous patterns in one file', async () => {
        const dangerousContent = `
          require("child_process");
          require("fs");
          eval("bad");
          process.exit(1);
          new Function("test")();
        `;
        
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from(dangerousContent), 'dangerous.js');

        expect(response.status).toBe(200);
        expect(response.body.scriptInfo.warnings.length).toBe(5);
      });

      it('should not flag safe code', async () => {
        const safeContent = 'const result = [1,2,3].filter(x => x > 1);';
        
        const response = await request(app)
          .post('/upload')
          .attach('scriptFile', Buffer.from(safeContent), 'safe.js');

        expect(response.status).toBe(200);
        expect(response.body.scriptInfo.warnings).toHaveLength(0);
      });
    });

    // No file scenarios
    describe('No file scenarios', () => {
      it('should handle no file with script submission type', async () => {
        const response = await request(app)
          .post('/upload')
          .field('submissionType', 'script');

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('MISSING_SCRIPT');
      });

      it('should allow no file when scriptContent is provided', async () => {
        const response = await request(app)
          .post('/upload')
          .field('submissionType', 'script')
          .field('scriptContent', 'console.log("test")');

        expect(response.status).toBe(200);
      });

      it('should allow no file for query submission type', async () => {
        const response = await request(app)
          .post('/upload')
          .field('submissionType', 'query');

        expect(response.status).toBe(200);
      });

      it('should allow empty request', async () => {
        const response = await request(app)
          .post('/upload');

        expect(response.status).toBe(200);
      });
    });
  });

  describe('validateScriptContent middleware', () => {
    beforeEach(() => {
      app.post('/validate', express.json(), validateScriptContent, (req, res) => {
        res.json({
          success: true,
          scriptInfo: req.scriptInfo || null,
        });
      });
    });

    it('should call next when submissionType is query', async () => {
      const response = await request(app)
        .post('/validate')
        .send({ submissionType: 'query' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return error when script submission without file', async () => {
      const response = await request(app)
        .post('/validate')
        .send({ submissionType: 'script' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('MISSING_SCRIPT');
    });

    it('should allow script submission with scriptContent', async () => {
      const response = await request(app)
        .post('/validate')
        .send({ 
          submissionType: 'script',
          scriptContent: 'console.log("test")',
        });

      expect(response.status).toBe(200);
    });

    it('should pass when no submissionType provided', async () => {
      const response = await request(app)
        .post('/validate')
        .send({});

      expect(response.status).toBe(200);
    });
  });

  describe('cleanupFile function', () => {
    it('should handle cleanup of non-existent file without error', async () => {
      await expect(cleanupFile('/nonexistent/path/file.js')).resolves.not.toThrow();
    });

    it('should be callable multiple times', async () => {
      await expect(cleanupFile('/fake/path1.js')).resolves.not.toThrow();
      await expect(cleanupFile('/fake/path2.js')).resolves.not.toThrow();
    });

    it('should handle empty string path', async () => {
      await expect(cleanupFile('')).resolves.not.toThrow();
    });

    it('should handle null path', async () => {
      await expect(cleanupFile(null)).resolves.not.toThrow();
    });

    it('should handle undefined path', async () => {
      await expect(cleanupFile(undefined)).resolves.not.toThrow();
    });
  });
});