/**
 * Query Validation Schemas Tests
 */

import {
    SubmitRequestSchema,
    RejectRequestSchema,
    RequestQuerySchema,
    SubmissionTypeEnum
} from '../../src/validation/querySchemas';

describe('Query Validation Schemas', () => {
    describe('SubmissionTypeEnum', () => {
        it('should accept "query"', () => {
            const result = SubmissionTypeEnum.safeParse('query');
            expect(result.success).toBe(true);
        });

        it('should accept "script"', () => {
            const result = SubmissionTypeEnum.safeParse('script');
            expect(result.success).toBe(true);
        });

        it('should reject invalid type', () => {
            const result = SubmissionTypeEnum.safeParse('invalid');
            expect(result.success).toBe(false);
        });
    });

    describe('SubmitRequestSchema', () => {
        const validQueryData = {
            instanceId: 'postgres-1',
            databaseName: 'test_db',
            submissionType: 'query' as const,
            queryContent: 'SELECT * FROM users LIMIT 10',
            comments: 'Test query',
            podId: 'pod-1'
        };

        describe('Valid Input', () => {
            it('should accept valid query submission', () => {
                const result = SubmitRequestSchema.safeParse(validQueryData);
                expect(result.success).toBe(true);
            });

            it('should accept valid script submission', () => {
                const data = {
                    instanceId: 'postgres-1',
                    databaseName: 'test_db',
                    submissionType: 'script' as const,
                    scriptContent: 'console.log("test")',
                    scriptFilename: 'test.js',
                    comments: 'Test script',
                    podId: 'pod-1'
                };

                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(true);
            });

            it('should trim comments', () => {
                const data = {
                    ...validQueryData,
                    comments: '  Test query  '
                };

                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(true);
                if (result.success) {
                    expect(result.data.comments).toBe('Test query');
                }
            });
        });

        describe('Invalid Input - Required Fields', () => {
            it('should reject missing instanceId', () => {
                const data = { ...validQueryData };
                delete (data as any).instanceId;

                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });

            it('should reject missing databaseName', () => {
                const data = { ...validQueryData };
                delete (data as any).databaseName;

                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });

            it('should reject missing submissionType', () => {
                const data = { ...validQueryData };
                delete (data as any).submissionType;

                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });

            it('should reject missing comments', () => {
                const data = { ...validQueryData };
                delete (data as any).comments;

                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });

            it('should reject missing podId', () => {
                const data = { ...validQueryData };
                delete (data as any).podId;

                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });
        });

        describe('Invalid Input - Field Validation', () => {
            it('should reject empty instanceId', () => {
                const data = { ...validQueryData, instanceId: '' };
                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });

            it('should reject too long instanceId', () => {
                const data = { ...validQueryData, instanceId: 'a'.repeat(300) };
                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });

            it('should reject empty comments after trim', () => {
                const data = { ...validQueryData, comments: '   ' };
                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });

            it('should reject too long comments', () => {
                const data = { ...validQueryData, comments: 'a'.repeat(1100) };
                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });

            it('should reject too long queryContent', () => {
                const data = { ...validQueryData, queryContent: 'a'.repeat(51000) };
                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });

            it('should reject invalid submissionType', () => {
                const data = { ...validQueryData, submissionType: 'invalid' as any };
                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });
        });

        describe('Query Type Validation', () => {
            it('should reject query type without queryContent', () => {
                const data = { ...validQueryData };
                delete (data as any).queryContent;

                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });

            it('should reject query type with empty queryContent', () => {
                const data = { ...validQueryData, queryContent: '   ' };
                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });
        });

        describe('Script Type Validation', () => {
            it('should accept script without scriptContent (file upload)', () => {
                const data = {
                    instanceId: 'postgres-1',
                    databaseName: 'test_db',
                    submissionType: 'script' as const,
                    comments: 'Test script',
                    podId: 'pod-1'
                };

                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(true);
            });

            it('should reject invalid script filename extension', () => {
                const data = {
                    instanceId: 'postgres-1',
                    databaseName: 'test_db',
                    submissionType: 'script' as const,
                    scriptContent: 'test',
                    scriptFilename: 'test.txt',
                    comments: 'Test',
                    podId: 'pod-1'
                };

                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });

            it('should accept .js extension', () => {
                const data = {
                    instanceId: 'postgres-1',
                    databaseName: 'test_db',
                    submissionType: 'script' as const,
                    scriptContent: 'test',
                    scriptFilename: 'test.js',
                    comments: 'Test',
                    podId: 'pod-1'
                };

                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(true);
            });

            it('should accept .py extension', () => {
                const data = {
                    instanceId: 'postgres-1',
                    databaseName: 'test_db',
                    submissionType: 'script' as const,
                    scriptContent: 'test',
                    scriptFilename: 'test.py',
                    comments: 'Test',
                    podId: 'pod-1'
                };

                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(true);
            });

            it('should reject too long scriptContent', () => {
                const data = {
                    instanceId: 'postgres-1',
                    databaseName: 'test_db',
                    submissionType: 'script' as const,
                    scriptContent: 'a'.repeat(510000),
                    scriptFilename: 'test.js',
                    comments: 'Test',
                    podId: 'pod-1'
                };

                const result = SubmitRequestSchema.safeParse(data);
                expect(result.success).toBe(false);
            });
        });
    });

    describe('RejectRequestSchema', () => {
        it('should accept valid rejection reason', () => {
            const data = { reason: 'Query is too dangerous' };
            const result = RejectRequestSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should trim reason', () => {
            const data = { reason: '  Test reason  ' };
            const result = RejectRequestSchema.safeParse(data);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.reason).toBe('Test reason');
            }
        });

        it('should reject empty reason', () => {
            const data = { reason: '' };
            const result = RejectRequestSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject whitespace-only reason', () => {
            const data = { reason: '   ' };
            const result = RejectRequestSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject too long reason', () => {
            const data = { reason: 'a'.repeat(600) };
            const result = RejectRequestSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject missing reason', () => {
            const data = {};
            const result = RejectRequestSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('RequestQuerySchema', () => {
        it('should accept valid query params', () => {
            const data = {
                status: 'pending',
                podId: 'pod-1',
                instanceId: 'postgres-1',
                submissionType: 'query',
                databaseType: 'postgresql',
                userId: '123e4567-e89b-12d3-a456-426614174000',
                search: 'test',
                startDate: '2024-01-01T00:00:00Z',
                endDate: '2024-12-31T23:59:59Z'
            };

            const result = RequestQuerySchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should accept empty query params', () => {
            const data = {};
            const result = RequestQuerySchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should accept partial query params', () => {
            const data = { status: 'pending', podId: 'pod-1' };
            const result = RequestQuerySchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should reject invalid UUID for userId', () => {
            const data = { userId: 'not-a-uuid' };
            const result = RequestQuerySchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject invalid datetime for startDate', () => {
            const data = { startDate: 'not-a-date' };
            const result = RequestQuerySchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject invalid datetime for endDate', () => {
            const data = { endDate: 'not-a-date' };
            const result = RequestQuerySchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });
});
