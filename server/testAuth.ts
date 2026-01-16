/**
 * Test Authentication Module
 *
 * This module provides mock authentication for E2E testing.
 * It creates test users and generates session tokens without OAuth.
 *
 * IMPORTANT: This should only be used in test/development environments.
 */

import { Router } from 'express';
import { COOKIE_NAME, ONE_YEAR_MS } from '@shared/const';
import { sdk } from './_core/sdk';
import * as db from './db';

// Test user credentials (hardcoded for E2E testing)
export const TEST_USERS = {
  testUser1: {
    openId: 'test-user-001',
    name: 'Test User One',
    email: 'testuser1@test.com',
    password: 'testpass123',
    role: 'user' as const,
  },
  testUser2: {
    openId: 'test-user-002',
    name: 'Test User Two',
    email: 'testuser2@test.com',
    password: 'testpass456',
    role: 'user' as const,
  },
  adminUser: {
    openId: 'test-admin-001',
    name: 'Test Admin',
    email: 'admin@test.com',
    password: 'adminpass789',
    role: 'admin' as const,
  },
};

export const testAuthRouter = Router();

/**
 * POST /api/test-auth/login
 *
 * Login with test credentials (for E2E testing only)
 *
 * Request body:
 * {
 *   "email": "testuser1@test.com",
 *   "password": "testpass123"
 * }
 */
testAuthRouter.post('/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find matching test user
    const testUser = Object.values(TEST_USERS).find(
      (user) => user.email === email && user.password === password
    );

    if (!testUser) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Ensure test user exists in database
    await db.upsertUser({
      openId: testUser.openId,
      name: testUser.name,
      email: testUser.email,
      loginMethod: 'test',
      lastSignedIn: new Date(),
    });

    // Update role if needed
    const existingUser = await db.getUserByOpenId(testUser.openId);
    if (existingUser && existingUser.role !== testUser.role) {
      // Role update would need a separate function, skip for now
    }

    // Create session token
    const sessionToken = await sdk.createSessionToken(testUser.openId, {
      name: testUser.name,
      expiresInMs: ONE_YEAR_MS,
    });

    // Set session cookie
    res.cookie(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ONE_YEAR_MS,
      path: '/',
    });

    return res.json({
      success: true,
      user: {
        openId: testUser.openId,
        name: testUser.name,
        email: testUser.email,
        role: testUser.role,
      },
    });
  } catch (error) {
    console.error('[TestAuth] Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/test-auth/logout
 *
 * Logout test user (clear session cookie)
 */
testAuthRouter.post('/logout', (req: any, res: any) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.json({ success: true });
});

/**
 * GET /api/test-auth/users
 *
 * Get list of available test users (for documentation)
 */
testAuthRouter.get('/users', (req: any, res: any) => {
  const users = Object.entries(TEST_USERS).map(([key, user]) => ({
    key,
    email: user.email,
    password: user.password,
    name: user.name,
    role: user.role,
  }));

  return res.json({ users });
});

/**
 * POST /api/test-auth/seed
 *
 * Seed test users into database
 */
testAuthRouter.post('/seed', async (req: any, res: any) => {
  try {
    for (const testUser of Object.values(TEST_USERS)) {
      await db.upsertUser({
        openId: testUser.openId,
        name: testUser.name,
        email: testUser.email,
        loginMethod: 'test',
        lastSignedIn: new Date(),
      });
    }

    return res.json({ success: true, message: 'Test users seeded' });
  } catch (error) {
    console.error('[TestAuth] Seed error:', error);
    return res.status(500).json({ error: 'Failed to seed test users' });
  }
});
