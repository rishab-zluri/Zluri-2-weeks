/**
 * User Controller
 * Handles user management operations (Admin only)
 */

import { Request, Response, NextFunction } from 'express';
import { User, UserRole } from '../entities/User';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import * as response from '../utils/response';
import { parsePagination } from '../utils/validators';
import { AuthenticatedUser } from '../types/express';
import { getEntityManager } from '../db';
import bcrypt from 'bcryptjs';

// =============================================================================
// TYPES
// =============================================================================

interface UserQuery {
    role?: string;
    podId?: string;
    search?: string;
    isActive?: string;
    page?: string;
    limit?: string;
    [key: string]: any; // Add index signature for PaginationQuery compatibility
}

interface UpdateUserBody {
    name?: string;
    role?: UserRole;
    podId?: string;
    slackUserId?: string;
    isActive?: boolean;
}

interface ResetPasswordBody {
    newPassword?: string;
}

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * Get all users with pagination and filters
 * GET /api/users
 */
export const getUsers = async (req: Request<unknown, unknown, unknown, UserQuery>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { page, limit, offset } = parsePagination(req.query);
        const { role, podId, search, isActive } = req.query;
        const em = getEntityManager();

        const where: any = {};
        if (role) where.role = role;
        if (podId) where.podId = podId;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        if (search) {
            where.name = { $ilike: `%${search}%` };
            // OR email? MikroORM default $or syntax
            // where.$or = [{ name: { $ilike: `%${search}%` } }, { email: { $ilike: `%${search}%` } }];
        }

        const [users, total] = await em.findAndCount(User, where, {
            limit,
            offset,
            orderBy: { name: 'ASC' }
        });

        response.paginated(res, users, { page, limit, total });
    } catch (error) {
        next(error);
    }
};

/**
 * Get a specific user by ID
 * GET /api/users/:id
 */
export const getUserById = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const em = getEntityManager();
        const user = await em.findOne(User, { id: req.params.id });
        if (!user) {
            throw new NotFoundError('User not found');
        }
        response.success(res, user);
    } catch (error) {
        next(error);
    }
};

/**
 * Update a user
 * PUT /api/users/:id
 */
export const updateUser = async (req: Request<{ id: string }, unknown, UpdateUserBody>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { name, role, podId, slackUserId, isActive } = req.body;
        const currentUserId = req.user?.id.toString();
        const em = getEntityManager();

        const user = await em.findOne(User, { id: req.params.id });
        if (!user) {
            throw new NotFoundError('User not found');
        }

        // Prevent admin from deactivating themselves
        if (currentUserId === req.params.id && isActive === false) {
            throw new ValidationError('Cannot deactivate your own account');
        }

        if (name !== undefined) user.name = name;
        if (role !== undefined) user.role = role;
        if (podId !== undefined) user.podId = podId;
        if (slackUserId !== undefined) user.slackUserId = slackUserId;
        if (isActive !== undefined) user.isActive = isActive;

        await em.flush();
        response.success(res, user, 'User updated successfully');
    } catch (error) {
        next(error);
    }
};

/**
 * Soft delete a user (deactivate)
 * DELETE /api/users/:id
 */
export const deleteUser = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const currentUserId = req.user?.id.toString();
        const em = getEntityManager();

        // Prevent admin from deleting themselves
        if (currentUserId === req.params.id) {
            throw new ValidationError('Cannot delete your own account');
        }

        const user = await em.findOne(User, { id: req.params.id });
        if (!user) {
            throw new NotFoundError('User not found');
        }

        user.isActive = false;
        await em.flush();
        response.success(res, null, 'User deactivated successfully');
    } catch (error) {
        next(error);
    }
};

/**
 * Reactivate a deactivated user
 * POST /api/users/:id/activate
 */
export const activateUser = async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    try {
        const em = getEntityManager();
        const user = await em.findOne(User, { id: req.params.id });
        if (!user) {
            throw new NotFoundError('User not found');
        }

        user.isActive = true;
        await em.flush();
        response.success(res, user, 'User activated successfully');
    } catch (error) {
        next(error);
    }
};

/**
 * Reset a user's password
 * POST /api/users/:id/reset-password
 */
export const resetPassword = async (req: Request<{ id: string }, unknown, ResetPasswordBody>, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Note: Validation of newPassword strength is handled by middleware
        const { newPassword } = req.body;

        if (!newPassword) {
            throw new ValidationError('New password is required');
        }

        const em = getEntityManager();
        const user = await em.findOne(User, { id: req.params.id });
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(newPassword, salt);

        await em.flush();
        response.success(res, null, 'Password reset successfully');
    } catch (error) {
        next(error);
    }
};
