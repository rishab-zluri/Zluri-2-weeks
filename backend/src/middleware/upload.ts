/**
 * File Upload Middleware
 * Handle script file uploads using multer
 *
 * FLOW:
 * 1. uploadScript - Raw multer middleware (internal use)
 * 2. validateScriptContent - Creates req.scriptInfo from req.file
 * 3. handleScriptUpload - COMBINED middleware (use this in routes!)
 */

import multer, { FileFilterCallback, StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import config from '../config';
import { ValidationError } from '../utils/errors';
import response from '../utils/response';

// ============================================================================
// Types
// ============================================================================

/**
 * Script information extracted from uploaded file
 */
export interface ScriptInfo {
    filename: string;
    content: string;
    size: number;
    mimetype: string;
    warnings: string[];
}

/**
 * Express request with script info
 */
declare global {
    namespace Express {
        interface Request {
            scriptInfo?: ScriptInfo;
        }
    }
}

/**
 * Multer file with buffer
 */
interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
    destination?: string;
    filename?: string;
    path?: string;
}

// ============================================================================
// Setup
// ============================================================================

// Ensure upload directory exists
const uploadDir = config.upload.uploadDir;
/* istanbul ignore if */
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ============================================================================
// Storage Configurations
// ============================================================================

/**
 * Disk storage configuration
 */
const storage: StorageEngine = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
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

// ============================================================================
// File Filter
// ============================================================================

/**
 * File filter function
 * Only allows configured extensions (.js and .py by default)
 */
function fileFilter(
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
): void {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!config.upload.allowedExtensions.includes(ext)) {
        return cb(
            new ValidationError(
                `Invalid file type. Allowed types: ${config.upload.allowedExtensions.join(', ')}`
            )
        );
    }

    // Pass through - extension is valid
    cb(null, true);
}

// ============================================================================
// Multer Instances
// ============================================================================

/**
 * Multer upload configuration (disk storage)
 */
export const upload = multer({
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
export const memoryUpload = multer({
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
export const uploadScript = memoryUpload.single('scriptFile');

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Handle multer errors and send appropriate response
 */
function handleMulterError(err: Error, res: Response): Response {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return response.error(
                res,
                `File too large. Maximum size is ${config.upload.maxFileSize / (1024 * 1024)}MB`,
                400,
                'VALIDATION_ERROR'
            );
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return response.error(
                res,
                `Unexpected field. Use 'scriptFile' for file upload`,
                400,
                'VALIDATION_ERROR'
            );
        }
        /* istanbul ignore next */
        return response.error(res, `Upload error: ${err.message}`, 400, 'VALIDATION_ERROR');
    }

    if (err instanceof ValidationError) {
        return response.error(res, err.message, 400, 'VALIDATION_ERROR');
    }

    /* istanbul ignore next */
    return response.error(res, 'File upload failed', 500, 'INTERNAL_ERROR');
}

// ============================================================================
// Middleware Functions
// ============================================================================

/**
 * Dangerous patterns to check in scripts
 */
const DANGEROUS_PATTERNS: RegExp[] = [
    /require\s*\(\s*['"]child_process['"]\s*\)/,
    /require\s*\(\s*['"]fs['"]\s*\)/,
    /process\.exit/,
    /eval\s*\(/,
    /Function\s*\(/,
];

/**
 * Legacy middleware wrapper with error handling
 */
export const handleUpload: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    uploadScript(req, res, (err) => {
        if (err) {
            handleMulterError(err as Error, res);
            return;
        }
        next();
    });
};

/**
 * Validate uploaded file content and create req.scriptInfo
 * MUST be called AFTER uploadScript or handleUpload
 */
export const validateScriptContent: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (!req.file) {
        // Script file is optional if scriptContent is provided in body
        if (
            (req.body as { submissionType?: string })?.submissionType === 'script' &&
            !(req.body as { scriptContent?: string })?.scriptContent
        ) {
            response.error(res, 'Script file is required', 400, 'VALIDATION_ERROR');
            return;
        }
        next();
        return;
    }

    const file = req.file as MulterFile;
    const content = file.buffer.toString('utf-8');

    // Check for security warnings
    const warnings: string[] = [];
    DANGEROUS_PATTERNS.forEach((pattern) => {
        if (pattern.test(content)) {
            warnings.push(`Script contains potentially restricted pattern: ${pattern.toString()}`);
        }
    });

    // Store file info and content in req.scriptInfo
    req.scriptInfo = {
        filename: file.originalname,
        content: content,
        size: file.size,
        mimetype: file.mimetype,
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
export const handleScriptUpload: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Step 1: Use multer to parse the upload
    uploadScript(req, res, (err) => {
        // Step 2: Handle multer errors
        if (err) {
            handleMulterError(err as Error, res);
            return;
        }

        // Step 3: Validate and create req.scriptInfo
        if (!req.file) {
            // No file uploaded - check if scriptContent is in body
            if (
                (req.body as { submissionType?: string })?.submissionType === 'script' &&
                !(req.body as { scriptContent?: string })?.scriptContent
            ) {
                response.error(res, 'Script file is required', 400, 'VALIDATION_ERROR');
                return;
            }
            next();
            return;
        }

        // File exists - read content and create scriptInfo
        const file = req.file as MulterFile;
        const content = file.buffer.toString('utf-8');

        // Check for security warnings
        const warnings: string[] = [];
        DANGEROUS_PATTERNS.forEach((pattern) => {
            if (pattern.test(content)) {
                warnings.push(`Script contains potentially restricted pattern: ${pattern.toString()}`);
            }
        });

        // Create req.scriptInfo
        req.scriptInfo = {
            filename: file.originalname,
            content: content,
            size: file.size,
            mimetype: file.mimetype,
            warnings: warnings,
        };

        next();
    });
};

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up uploaded file
 */
export async function cleanupFile(filePath: string): Promise<void> {
    try {
        if (filePath && fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
    } catch {
        // Ignore cleanup errors - not critical
    }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
    upload,
    memoryUpload,
    uploadScript,
    handleUpload,
    validateScriptContent,
    handleScriptUpload,
    cleanupFile,
};
