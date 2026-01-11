/**
 * User Model
 * Database operations for user management
 */

const bcrypt = require('bcryptjs');
const { query, transaction } = require('../config/database');
const logger = require('../utils/logger');
const { DatabaseError, NotFoundError, ConflictError, ValidationError } = require('../utils/errors');

const SALT_ROUNDS = 12;

/**
 * User roles enum
 */
const UserRoles = {
  DEVELOPER: 'developer',
  MANAGER: 'manager',
  ADMIN: 'admin',
};

/**
 * Create users table if not exists
 */
const createTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'developer',
      pod_id VARCHAR(50),
      slack_user_id VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      last_login TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_pod_id ON users(pod_id);
  `;

  try {
    await query(sql);
    logger.info('Users table created/verified');
  } catch (error) {
    logger.error('Failed to create users table', { error: error.message });
    throw new DatabaseError('Failed to create users table');
  }
};

/**
 * Create a new user
 * @param {Object} userData - User data
 * @returns {Object} Created user (without password)
 */
const create = async ({ email, password, name, role = UserRoles.DEVELOPER, podId = null, slackUserId = null }) => {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const sql = `
    INSERT INTO users (email, password_hash, name, role, pod_id, slack_user_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, email, name, role, pod_id, slack_user_id, is_active, created_at
  `;

  try {
    const result = await query(sql, [email.toLowerCase(), passwordHash, name, role, podId, slackUserId]);
    logger.info('User created', { userId: result.rows[0].id, email });
    return mapUserRow(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      throw new ConflictError('User with this email already exists');
    }
    logger.error('Failed to create user', { error: error.message });
    throw new DatabaseError('Failed to create user');
  }
};

/**
 * Find user by email
 * @param {string} email - User email
 * @param {boolean} includePassword - Include password hash
 * @returns {Object|null} User or null
 */
const findByEmail = async (email, includePassword = false) => {
  const columns = includePassword
    ? 'id, email, password_hash, name, role, pod_id, slack_user_id, is_active, last_login, created_at'
    : 'id, email, name, role, pod_id, slack_user_id, is_active, last_login, created_at';

  const sql = `SELECT ${columns} FROM users WHERE email = $1`;

  try {
    const result = await query(sql, [email.toLowerCase()]);
    if (result.rows.length === 0) return null;
    return mapUserRow(result.rows[0], includePassword);
  } catch (error) {
    logger.error('Failed to find user by email', { error: error.message });
    throw new DatabaseError('Failed to find user');
  }
};

/**
 * Find user by ID
 * @param {string} id - User ID
 * @returns {Object|null} User or null
 */
const findById = async (id) => {
  const sql = `
    SELECT id, email, name, role, pod_id, slack_user_id, is_active, last_login, created_at
    FROM users WHERE id = $1
  `;

  try {
    const result = await query(sql, [id]);
    if (result.rows.length === 0) return null;
    return mapUserRow(result.rows[0]);
  } catch (error) {
    logger.error('Failed to find user by ID', { error: error.message });
    throw new DatabaseError('Failed to find user');
  }
};

/**
 * Find all users with optional filters
 * @param {Object} filters - Filter options
 * @returns {Array} Array of users
 */
const findAll = async ({ role = null, podId = null, isActive = null, limit = 100, offset = 0 } = {}) => {
  let sql = `
    SELECT id, email, name, role, pod_id, slack_user_id, is_active, last_login, created_at
    FROM users WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (role) {
    sql += ` AND role = $${paramIndex++}`;
    params.push(role);
  }

  if (podId) {
    sql += ` AND pod_id = $${paramIndex++}`;
    params.push(podId);
  }

  if (isActive !== null) {
    sql += ` AND is_active = $${paramIndex++}`;
    params.push(isActive);
  }

  sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  params.push(limit, offset);

  try {
    const result = await query(sql, params);
    return result.rows.map((row) => mapUserRow(row));
  } catch (error) {
    logger.error('Failed to find users', { error: error.message });
    throw new DatabaseError('Failed to find users');
  }
};

/**
 * Count users with filters
 * @param {Object} filters - Filter options
 * @returns {number} Count of users
 */
const count = async ({ role = null, podId = null, isActive = null } = {}) => {
  let sql = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (role) {
    sql += ` AND role = $${paramIndex++}`;
    params.push(role);
  }

  if (podId) {
    sql += ` AND pod_id = $${paramIndex++}`;
    params.push(podId);
  }

  if (isActive !== null) {
    sql += ` AND is_active = $${paramIndex++}`;
    params.push(isActive);
  }

  try {
    const result = await query(sql, params);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    logger.error('Failed to count users', { error: error.message });
    throw new DatabaseError('Failed to count users');
  }
};

/**
 * Update user
 * @param {string} id - User ID
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated user
 */
const update = async (id, updates) => {
  const allowedFields = ['name', 'role', 'pod_id', 'slack_user_id', 'is_active'];
  const updateFields = [];
  const params = [];
  let paramIndex = 1;

  Object.entries(updates).forEach(([key, value]) => {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(snakeKey) && value !== undefined) {
      updateFields.push(`${snakeKey} = $${paramIndex++}`);
      params.push(value);
    }
  });

  if (updateFields.length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(id);

  const sql = `
    UPDATE users SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, email, name, role, pod_id, slack_user_id, is_active, created_at, updated_at
  `;

  try {
    const result = await query(sql, params);
    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }
    logger.info('User updated', { userId: id });
    return mapUserRow(result.rows[0]);
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error('Failed to update user', { error: error.message });
    throw new DatabaseError('Failed to update user');
  }
};

/**
 * Update password
 * @param {string} id - User ID
 * @param {string} newPassword - New password
 * @returns {boolean} Success status
 */
const updatePassword = async (id, newPassword) => {
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  const sql = `
    UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `;

  try {
    const result = await query(sql, [passwordHash, id]);
    if (result.rowCount === 0) {
      throw new NotFoundError('User not found');
    }
    logger.info('Password updated', { userId: id });
    return true;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error('Failed to update password', { error: error.message });
    throw new DatabaseError('Failed to update password');
  }
};

/**
 * Update last login timestamp
 * @param {string} id - User ID
 */
const updateLastLogin = async (id) => {
  const sql = `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`;

  try {
    await query(sql, [id]);
  } catch (error) {
    logger.warn('Failed to update last login', { userId: id, error: error.message });
  }
};

/**
 * Verify password
 * @param {string} plainPassword - Plain text password
 * @param {string} hashedPassword - Hashed password
 * @returns {boolean} Verification result
 */
const verifyPassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Delete user (soft delete)
 * @param {string} id - User ID
 * @returns {boolean} Success status
 */
const softDelete = async (id) => {
  const sql = `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`;

  try {
    const result = await query(sql, [id]);
    if (result.rowCount === 0) {
      throw new NotFoundError('User not found');
    }
    logger.info('User soft deleted', { userId: id });
    return true;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error('Failed to delete user', { error: error.message });
    throw new DatabaseError('Failed to delete user');
  }
};

/**
 * Map database row to user object
 * @param {Object} row - Database row
 * @param {boolean} includePassword - Include password hash
 * @returns {Object} Mapped user
 */
const mapUserRow = (row, includePassword = false) => {
  const user = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    podId: row.pod_id,
    slackUserId: row.slack_user_id,
    isActive: row.is_active,
    lastLogin: row.last_login,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (includePassword) {
    user.passwordHash = row.password_hash;
  }

  return user;
};

module.exports = {
  UserRoles,
  createTable,
  create,
  findByEmail,
  findById,
  findAll,
  count,
  update,
  updatePassword,
  updateLastLogin,
  verifyPassword,
  softDelete,
};