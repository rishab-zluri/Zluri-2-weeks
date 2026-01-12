/**
 * Response Utility Tests
 */

const {
  success,
  created,
  noContent,
  error,
  paginated,
} = require('../src/utils/response');

// Mock Express response object
const createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

describe('Response Utility', () => {
  describe('success', () => {
    it('should return 200 status by default', () => {
      const res = createMockResponse();
      success(res, { id: 1 });
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Success',
        data: { id: 1 },
      });
    });

    it('should allow custom status code', () => {
      const res = createMockResponse();
      success(res, null, 'Custom message', 202);
      
      expect(res.status).toHaveBeenCalledWith(202);
    });

    it('should not include data key when null', () => {
      const res = createMockResponse();
      success(res, null);
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData).not.toHaveProperty('data');
    });

    it('should allow custom message', () => {
      const res = createMockResponse();
      success(res, null, 'Operation completed');
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Operation completed',
      });
    });
  });

  describe('created', () => {
    it('should return 201 status', () => {
      const res = createMockResponse();
      created(res, { id: 1, name: 'Test' });
      
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should use default message', () => {
      const res = createMockResponse();
      created(res, { id: 1 });
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.message).toBe('Resource created successfully');
    });

    it('should allow custom message', () => {
      const res = createMockResponse();
      created(res, { id: 1 }, 'User created');
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.message).toBe('User created');
    });
  });

  describe('noContent', () => {
    it('should return 204 status', () => {
      const res = createMockResponse();
      noContent(res);
      
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should return 500 status by default', () => {
      const res = createMockResponse();
      error(res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'An error occurred',
        code: 'INTERNAL_ERROR',
      });
    });

    it('should allow custom status code and code', () => {
      const res = createMockResponse();
      error(res, 'Not found', 404, 'NOT_FOUND');
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Not found',
        code: 'NOT_FOUND',
      });
    });

    it('should include validation errors when provided', () => {
      const res = createMockResponse();
      const errors = [{ field: 'email', message: 'Invalid' }];
      error(res, 'Validation failed', 400, 'VALIDATION_ERROR', errors);
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.errors).toEqual(errors);
    });
  });

  describe('paginated', () => {
    it('should return paginated response', () => {
      const res = createMockResponse();
      const data = [{ id: 1 }, { id: 2 }];
      const pagination = { page: 1, limit: 10, total: 25 };
      
      paginated(res, data, pagination);
      
      expect(res.status).toHaveBeenCalledWith(200);
      const responseData = res.json.mock.calls[0][0];
      
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(data);
      expect(responseData.pagination.page).toBe(1);
      expect(responseData.pagination.limit).toBe(10);
      expect(responseData.pagination.total).toBe(25);
      expect(responseData.pagination.totalPages).toBe(3);
    });

    it('should calculate hasNext correctly', () => {
      const res = createMockResponse();
      
      // Page 1 of 3 - has next
      paginated(res, [], { page: 1, limit: 10, total: 25 });
      let responseData = res.json.mock.calls[0][0];
      expect(responseData.pagination.hasNext).toBe(true);
      
      // Page 3 of 3 - no next
      const res2 = createMockResponse();
      paginated(res2, [], { page: 3, limit: 10, total: 25 });
      responseData = res2.json.mock.calls[0][0];
      expect(responseData.pagination.hasNext).toBe(false);
    });

    it('should calculate hasPrev correctly', () => {
      const res = createMockResponse();
      
      // Page 1 - no prev
      paginated(res, [], { page: 1, limit: 10, total: 25 });
      let responseData = res.json.mock.calls[0][0];
      expect(responseData.pagination.hasPrev).toBe(false);
      
      // Page 2 - has prev
      const res2 = createMockResponse();
      paginated(res2, [], { page: 2, limit: 10, total: 25 });
      responseData = res2.json.mock.calls[0][0];
      expect(responseData.pagination.hasPrev).toBe(true);
    });

    it('should allow custom message', () => {
      const res = createMockResponse();
      paginated(res, [], { page: 1, limit: 10, total: 0 }, 'Queries retrieved');
      
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.message).toBe('Queries retrieved');
    });
  });
});
