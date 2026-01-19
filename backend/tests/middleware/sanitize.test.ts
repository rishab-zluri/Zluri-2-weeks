/**
 * Sanitize Middleware Tests
 */

import { Request, Response, NextFunction } from 'express';
import { sanitizeInput } from '../../src/middleware/sanitize';

describe('Sanitize Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockReq = {
            body: {},
            query: {},
            params: {}
        };
        mockRes = {};
        mockNext = jest.fn();
    });

    describe('XSS Prevention', () => {
        it('should sanitize script tags in body', () => {
            mockReq.body = {
                comment: '<script>alert("xss")</script>Hello World'
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.comment).not.toContain('<script>');
            expect(mockReq.body.comment).toContain('Hello World');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should sanitize img onerror tags', () => {
            mockReq.body = {
                content: '<img src="x" onerror="alert(1)">'
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.content).not.toContain('onerror');
        });

        it('should sanitize iframe tags', () => {
            mockReq.body = {
                html: '<iframe src="malicious.com"></iframe>'
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.html).not.toContain('<iframe');
        });

        it('should sanitize javascript: protocol', () => {
            mockReq.body = {
                link: '<a href="javascript:alert(1)">Click</a>'
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.link).not.toContain('javascript:');
        });

        it('should sanitize event handlers', () => {
            mockReq.body = {
                html: '<div onclick="malicious()">Click me</div>'
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.html).not.toContain('onclick');
        });

        it('should handle multiple XSS attempts', () => {
            mockReq.body = {
                text: '<script>alert(1)</script><img onerror="alert(2)"><iframe src="x"></iframe>'
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.text).not.toContain('<script>');
            expect(mockReq.body.text).not.toContain('onerror');
            expect(mockReq.body.text).not.toContain('<iframe');
        });
    });

    describe('SQL Injection Prevention', () => {
        it('should sanitize SQL comments', () => {
            mockReq.body = {
                query: "SELECT * FROM users WHERE id = 1; --"
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            // Should escape or remove SQL comments
            expect(mockReq.body.query).not.toContain('--');
        });

        it('should sanitize UNION attacks', () => {
            mockReq.body = {
                search: "' UNION SELECT password FROM users--"
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.search).not.toContain('UNION');
        });

        it('should sanitize DROP TABLE attempts', () => {
            mockReq.body = {
                input: "'; DROP TABLE users; --"
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.input).not.toContain('DROP TABLE');
        });
    });

    describe('Nested Objects', () => {
        it('should sanitize nested object properties', () => {
            mockReq.body = {
                user: {
                    name: '<script>alert("xss")</script>John',
                    email: 'john@example.com',
                    bio: '<img onerror="alert(1)">'
                }
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.user.name).not.toContain('<script>');
            expect(mockReq.body.user.name).toContain('John');
            expect(mockReq.body.user.email).toBe('john@example.com');
            expect(mockReq.body.user.bio).not.toContain('onerror');
        });

        it('should sanitize deeply nested objects', () => {
            mockReq.body = {
                level1: {
                    level2: {
                        level3: {
                            malicious: '<script>alert(1)</script>'
                        }
                    }
                }
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.level1.level2.level3.malicious).not.toContain('<script>');
        });
    });

    describe('Arrays', () => {
        it('should sanitize array elements', () => {
            mockReq.body = {
                tags: [
                    '<script>xss</script>',
                    'valid-tag',
                    '<img onerror="alert(1)">'
                ]
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            mockReq.body.tags.forEach((tag: string) => {
                expect(tag).not.toContain('<script>');
                expect(tag).not.toContain('onerror');
            });
            expect(mockReq.body.tags).toContain('valid-tag');
        });

        it('should sanitize arrays of objects', () => {
            mockReq.body = {
                items: [
                    { name: '<script>alert(1)</script>Item 1' },
                    { name: 'Item 2' },
                    { name: '<img onerror="alert(1)">Item 3' }
                ]
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            mockReq.body.items.forEach((item: any) => {
                expect(item.name).not.toContain('<script>');
                expect(item.name).not.toContain('onerror');
            });
        });
    });

    describe('Query Parameters', () => {
        it('should sanitize query parameters', () => {
            mockReq.query = {
                search: '<script>alert(1)</script>',
                filter: 'valid'
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.query.search).not.toContain('<script>');
            expect(mockReq.query.filter).toBe('valid');
        });

        it('should sanitize URL params', () => {
            mockReq.params = {
                id: '<script>alert(1)</script>123'
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.params.id).not.toContain('<script>');
        });
    });

    describe('Edge Cases', () => {
        it('should handle null values', () => {
            mockReq.body = {
                value: null
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.value).toBeNull();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle undefined values', () => {
            mockReq.body = {
                value: undefined
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.value).toBeUndefined();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle numbers', () => {
            mockReq.body = {
                count: 42,
                price: 19.99
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.count).toBe(42);
            expect(mockReq.body.price).toBe(19.99);
        });

        it('should handle booleans', () => {
            mockReq.body = {
                isActive: true,
                isDeleted: false
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.isActive).toBe(true);
            expect(mockReq.body.isDeleted).toBe(false);
        });

        it('should handle empty strings', () => {
            mockReq.body = {
                value: ''
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.value).toBe('');
        });

        it('should handle empty objects', () => {
            mockReq.body = {};
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body).toEqual({});
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle empty arrays', () => {
            mockReq.body = {
                items: []
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.items).toEqual([]);
        });

        it('should preserve safe HTML entities', () => {
            mockReq.body = {
                text: 'Price: $100 &amp; free shipping'
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.text).toContain('&amp;');
        });

        it('should handle very long strings', () => {
            mockReq.body = {
                longText: 'a'.repeat(10000) + '<script>alert(1)</script>'
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            expect(mockReq.body.longText).not.toContain('<script>');
            expect(mockReq.body.longText.length).toBeGreaterThan(9000);
        });

        it('should handle special characters', () => {
            mockReq.body = {
                text: '!@#$%^&*()_+-=[]{}|;:,.<>?'
            };
            
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            
            // Special characters should be preserved if not malicious
            expect(mockReq.body.text).toContain('!@#$%');
        });
    });

    describe('Performance', () => {
        it('should handle large objects efficiently', () => {
            const largeObject: any = {};
            for (let i = 0; i < 1000; i++) {
                largeObject[`field${i}`] = `value${i}`;
            }
            mockReq.body = largeObject;
            
            const start = Date.now();
            sanitizeInput(mockReq as Request, mockRes as Response, mockNext);
            const duration = Date.now() - start;
            
            expect(duration).toBeLessThan(100); // Should complete in < 100ms
            expect(mockNext).toHaveBeenCalled();
        });
    });
});
