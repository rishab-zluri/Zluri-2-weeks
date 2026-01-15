/**
 * Zod Validation Middleware
 *
 * Express middleware for request validation using Zod schemas.
 * Provides a clean, reusable pattern for validating request body, query, and params.
 *
 * WHY THIS EXISTS:
 * - Centralizes validation logic (DRY principle)
 * - Consistent error response format across all endpoints
 * - Type-safe: validated data is properly typed via generics
 * - Transforms data (e.g., coerces strings to numbers for pagination)
 *
 * PRODUCTION BENEFITS:
 * - Fail-fast: Invalid requests rejected before hitting business logic
 * - Security: Prevents injection attacks, DoS via large payloads
 * - Debugging: Clear error messages with field paths
 *
 * USAGE:
 * router.post('/users', validate(CreateUserSchema), controller.createUser);
 * router.get('/users', validateQuery(PaginationSchema), controller.getUsers);
 * router.get('/users/:id', validateParams(UuidParamSchema), controller.getUserById);
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Validation error detail structure
 * Provides clear, actionable feedback to API consumers
 */
interface ValidationErrorDetail {
    field: string;
    message: string;
    code: string;
}

/**
 * Format Zod errors into a clean, API-friendly structure
 *
 * WHY: Zod's default error format is verbose. This transforms it into
 * a simple array of { field, message, code } for easy frontend consumption.
 */
function formatZodError(error: ZodError<any>): ValidationErrorDetail[] {
    return error.issues.map((err: z.ZodIssue) => ({
        field: err.path.join('.') || 'root',
        message: err.message,
        code: err.code,
    }));
}

/**
 * Validate request body against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware that validates req.body
 *
 * BEHAVIOR:
 * - On success: Replaces req.body with parsed (and transformed) data
 * - On failure: Throws ValidationError with formatted details
 *
 * TYPE SAFETY:
 * After validation, req.body is typed according to the schema's output type.
 * This eliminates the need for manual type assertions in controllers.
 */
export function validate<T extends ZodSchema>(schema: T): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            // Parse and transform input data
            const parsed = schema.parse(req.body);

            // Replace body with validated/transformed data
            // This ensures downstream handlers receive clean, typed data
            req.body = parsed;

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const details = formatZodError(error);

                // Log validation failures for monitoring
                // Use 'debug' level to avoid log spam in production
                logger.debug('Request body validation failed', {
                    path: req.path,
                    method: req.method,
                    errors: details,
                });

                // Throw ValidationError which will be caught by error middleware
                const validationError = new ValidationError(
                    'Request validation failed',
                    details as any
                );
                next(validationError);
                return;
            }

            // Re-throw non-Zod errors (shouldn't happen, but safety first)
            next(error);
        }
    };
}

/**
 * Validate query parameters against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware that validates req.query
 *
 * WHY SEPARATE FROM validate():
 * - Query params come as strings (need z.coerce for numbers/booleans)
 * - Different error messaging for query params vs body
 * - Query params often have defaults (pagination)
 */
export function validateQuery<T extends ZodSchema>(schema: T): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            // Parse query params (Zod will coerce types as defined in schema)
            const parsed = schema.parse(req.query);

            // Replace query with validated/transformed data
            // Now req.query.page is a number, not a string
            (req as any).validatedQuery = parsed;

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const details = formatZodError(error);

                logger.debug('Query parameter validation failed', {
                    path: req.path,
                    query: req.query,
                    errors: details,
                });

                const validationError = new ValidationError(
                    'Query parameter validation failed',
                    details as any
                );
                next(validationError);
                return;
            }

            next(error);
        }
    };
}

/**
 * Validate URL parameters against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @returns Express middleware that validates req.params
 *
 * USE CASE:
 * - Validate UUIDs in /users/:id endpoints
 * - Validate numeric IDs
 * - Prevent path traversal attempts
 */
export function validateParams<T extends ZodSchema>(schema: T): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const parsed = schema.parse(req.params);

            // Attach validated params for type-safe access
            (req as any).validatedParams = parsed;

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const details = formatZodError(error);

                logger.debug('URL parameter validation failed', {
                    path: req.path,
                    params: req.params,
                    errors: details,
                });

                const validationError = new ValidationError(
                    'URL parameter validation failed',
                    details as any
                );
                next(validationError);
                return;
            }

            next(error);
        }
    };
}

/**
 * Type helper for accessing validated query in controllers
 *
 * USAGE:
 * const { page, limit } = getValidatedQuery<PaginationInput>(req);
 */
export function getValidatedQuery<T>(req: Request): T {
    return (req as any).validatedQuery as T;
}

/**
 * Type helper for accessing validated params in controllers
 *
 * USAGE:
 * const { id } = getValidatedParams<UuidParamInput>(req);
 */
export function getValidatedParams<T>(req: Request): T {
    return (req as any).validatedParams as T;
}
