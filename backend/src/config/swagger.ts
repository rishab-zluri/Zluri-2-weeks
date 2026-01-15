/**
 * OpenAPI/Swagger Configuration
 * 
 * Defines the base OpenAPI 3.0.0 specification for the API.
 * Uses swagger-jsdoc to scan for annotations in routes and controllers.
 */

import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'DB Query Portal API',
            version,
            description: 'Database Query Portal Backend API serving secure query execution across PostgreSQL and MongoDB instances.',
            contact: {
                name: 'Zluri SRE Team',
            },
        },
        servers: [
            {
                url: '/api/v1',
                description: 'API V1 Base Path',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token obtained from /auth/login or /auth/refresh'
                },
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'access_token',
                    description: 'HttpOnly cookie containing JWT access token'
                }
            },
            parameters: {
                UuidPathParam: {
                    in: 'path',
                    name: 'uuid',
                    required: true,
                    description: 'UUID identifier for the resource',
                    schema: {
                        type: 'string',
                        format: 'uuid',
                        pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
                    },
                    example: '123e4567-e89b-12d3-a456-426614174000'
                },
                PageParam: {
                    in: 'query',
                    name: 'page',
                    description: 'Page number for pagination',
                    schema: {
                        type: 'integer',
                        minimum: 1,
                        default: 1
                    },
                    example: 1
                },
                LimitParam: {
                    in: 'query',
                    name: 'limit',
                    description: 'Number of items per page',
                    schema: {
                        type: 'integer',
                        minimum: 1,
                        maximum: 100,
                        default: 10
                    },
                    example: 10
                },
                InstanceIdParam: {
                    in: 'path',
                    name: 'instanceId',
                    required: true,
                    description: 'Database instance identifier',
                    schema: {
                        type: 'string',
                        pattern: '^[a-zA-Z0-9-_]+$',
                        minLength: 1,
                        maxLength: 255
                    },
                    example: 'postgres-prod-1'
                },
                IdempotencyKeyHeader: {
                    in: 'header',
                    name: 'Idempotency-Key',
                    required: false,
                    description: 'Unique key to prevent duplicate request processing',
                    schema: {
                        type: 'string',
                        format: 'uuid'
                    },
                    example: '550e8400-e29b-41d4-a716-446655440000'
                }
            },
            responses: {
                Unauthorized: {
                    description: 'Authentication required - missing or invalid token',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                status: 'error',
                                message: 'Authentication required'
                            }
                        }
                    }
                },
                Forbidden: {
                    description: 'Insufficient permissions for this operation',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                status: 'error',
                                message: 'Access denied. Admin role required.'
                            }
                        }
                    }
                },
                NotFound: {
                    description: 'Resource not found',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                status: 'error',
                                message: 'Resource not found'
                            }
                        }
                    }
                },
                ValidationError: {
                    description: 'Request validation failed',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ValidationError'
                            },
                            example: {
                                status: 'error',
                                message: 'Validation failed',
                                errors: [
                                    { field: 'email', message: 'Invalid email format' },
                                    { field: 'password', message: 'Password must be at least 8 characters' }
                                ]
                            }
                        }
                    }
                },
                RateLimitExceeded: {
                    description: 'Too many requests - rate limit exceeded',
                    headers: {
                        'X-RateLimit-Limit': {
                            description: 'Maximum requests allowed per window',
                            schema: { type: 'integer' },
                            example: 100
                        },
                        'X-RateLimit-Remaining': {
                            description: 'Requests remaining in current window',
                            schema: { type: 'integer' },
                            example: 0
                        },
                        'X-RateLimit-Reset': {
                            description: 'Unix timestamp when rate limit resets',
                            schema: { type: 'integer' },
                            example: 1640995200
                        }
                    },
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                status: 'error',
                                message: 'Rate limit exceeded. Try again later.'
                            }
                        }
                    }
                },
                InternalError: {
                    description: 'Internal server error',
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/Error'
                            },
                            example: {
                                status: 'error',
                                message: 'An unexpected error occurred'
                            }
                        }
                    }
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    required: ['status', 'message'],
                    properties: {
                        status: {
                            type: 'string',
                            enum: ['error'],
                            example: 'error'
                        },
                        message: {
                            type: 'string',
                            example: 'Something went wrong'
                        },
                    },
                },
                ValidationError: {
                    type: 'object',
                    required: ['status', 'message'],
                    properties: {
                        status: {
                            type: 'string',
                            enum: ['error'],
                            example: 'error'
                        },
                        message: {
                            type: 'string',
                            example: 'Validation failed'
                        },
                        errors: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['field', 'message'],
                                properties: {
                                    field: { type: 'string', example: 'email' },
                                    message: { type: 'string', example: 'Invalid email format' }
                                }
                            }
                        }
                    }
                },
                User: {
                    type: 'object',
                    required: ['id', 'email', 'name', 'role'],
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                            example: '123e4567-e89b-12d3-a456-426614174000'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            example: 'john.doe@company.com'
                        },
                        name: {
                            type: 'string',
                            minLength: 1,
                            maxLength: 100,
                            example: 'John Doe'
                        },
                        role: {
                            type: 'string',
                            enum: ['admin', 'manager', 'developer', 'readonly'],
                            example: 'developer'
                        },
                        podId: {
                            type: 'string',
                            nullable: true,
                            example: 'pod-engineering'
                        },
                        isActive: {
                            type: 'boolean',
                            example: true
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2024-01-15T10:30:00Z'
                        }
                    }
                },
                DatabaseInstance: {
                    type: 'object',
                    required: ['id', 'name', 'type'],
                    properties: {
                        id: {
                            type: 'string',
                            example: 'postgres-prod-1'
                        },
                        name: {
                            type: 'string',
                            example: 'Production PostgreSQL'
                        },
                        type: {
                            type: 'string',
                            enum: ['postgresql', 'mongodb'],
                            example: 'postgresql'
                        },
                        host: {
                            type: 'string',
                            example: 'db.internal.company.com'
                        },
                        port: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 65535,
                            example: 5432
                        },
                        isHealthy: {
                            type: 'boolean',
                            example: true
                        },
                        lastSyncAt: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                            example: '2024-01-15T10:30:00Z'
                        }
                    }
                },
                QueryRequest: {
                    type: 'object',
                    required: ['id', 'uuid', 'requestType', 'databaseType', 'status'],
                    properties: {
                        id: {
                            type: 'integer',
                            example: 12345
                        },
                        uuid: {
                            type: 'string',
                            format: 'uuid',
                            example: '550e8400-e29b-41d4-a716-446655440000'
                        },
                        requestType: {
                            type: 'string',
                            enum: ['query', 'script'],
                            example: 'query'
                        },
                        databaseType: {
                            type: 'string',
                            enum: ['postgresql', 'mongodb'],
                            example: 'postgresql'
                        },
                        databaseName: {
                            type: 'string',
                            example: 'analytics_db'
                        },
                        queryContent: {
                            type: 'string',
                            example: 'SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL 1 DAY'
                        },
                        status: {
                            type: 'string',
                            enum: ['pending', 'approved', 'rejected', 'executed', 'failed'],
                            example: 'pending'
                        },
                        riskLevel: {
                            type: 'string',
                            enum: ['safe', 'low', 'medium', 'high', 'critical'],
                            example: 'low'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2024-01-15T10:30:00Z'
                        },
                        user: {
                            $ref: '#/components/schemas/User'
                        },
                        instance: {
                            $ref: '#/components/schemas/DatabaseInstance'
                        },
                        comments: {
                            type: 'string',
                            nullable: true,
                            example: 'Monthly active users report'
                        }
                    }
                },
                PaginationLinks: {
                    type: 'object',
                    required: ['self', 'first', 'last'],
                    properties: {
                        self: {
                            type: 'string',
                            format: 'uri',
                            example: '/api/v1/queries/my-requests?page=2&limit=10'
                        },
                        next: {
                            type: 'string',
                            format: 'uri',
                            nullable: true,
                            example: '/api/v1/queries/my-requests?page=3&limit=10'
                        },
                        prev: {
                            type: 'string',
                            format: 'uri',
                            nullable: true,
                            example: '/api/v1/queries/my-requests?page=1&limit=10'
                        },
                        first: {
                            type: 'string',
                            format: 'uri',
                            example: '/api/v1/queries/my-requests?page=1&limit=10'
                        },
                        last: {
                            type: 'string',
                            format: 'uri',
                            example: '/api/v1/queries/my-requests?page=10&limit=10'
                        }
                    }
                },
                PaginationMeta: {
                    type: 'object',
                    required: ['total', 'page', 'limit', 'totalPages'],
                    properties: {
                        total: {
                            type: 'integer',
                            minimum: 0,
                            description: 'Total number of items',
                            example: 95
                        },
                        page: {
                            type: 'integer',
                            minimum: 1,
                            description: 'Current page number',
                            example: 2
                        },
                        limit: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 100,
                            description: 'Items per page',
                            example: 10
                        },
                        totalPages: {
                            type: 'integer',
                            minimum: 0,
                            description: 'Total number of pages',
                            example: 10
                        }
                    }
                },
                PaginatedQueryRequests: {
                    type: 'object',
                    required: ['success', 'data', 'pagination'],
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true
                        },
                        data: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/QueryRequest'
                            }
                        },
                        pagination: {
                            $ref: '#/components/schemas/PaginationMeta'
                        },
                        links: {
                            $ref: '#/components/schemas/PaginationLinks'
                        }
                    }
                }
            },
        },
        security: [
            { bearerAuth: [] },
            { cookieAuth: [] }
        ],
    },
    // Path to the API docs
    apis: [
        './src/routes/*.ts',
        './src/controllers/*.ts',
        './src/app.ts' // In case we add global docs there
    ],
};

export const swaggerSpec = swaggerJsdoc(options);
