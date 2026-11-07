import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  registerSchema,
  loginSchema,
  profilePatchSchema,
} from '@meow/contracts/auth';

const mockUsersFind = vi.fn();
const mockUsersCountDocuments = vi.fn();

vi.mock('../../config/mongodb.js', () => ({
  getUsersCollection: () => ({
    find: (...args) => mockUsersFind(...args),
    countDocuments: (...args) => mockUsersCountDocuments(...args),
  }),
  getPushDevicesCollection: () => ({
    find: () => ({ toArray: vi.fn().mockResolvedValue([]) }),
    distinct: vi.fn().mockResolvedValue([]),
  }),
  getAuditLogCollection: () => ({ insertOne: vi.fn() }),
}));

vi.mock('../../services/pushNotificationService.js', () => ({
  sendPushToUser: vi.fn(),
}));

const { getUsers, getDashboardStats } = await import('../../controllers/adminUsers.controller.js');

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('VULN-09 Regression: Enforced CSP, Auth Schema Bounds, Array Query Type Confusion & 500 Error Redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('configures enforced Content-Security-Policy header in frontend/next.config.ts', () => {
    const nextConfigPath = path.resolve(process.cwd(), '../frontend/next.config.ts');
    const source = fs.readFileSync(nextConfigPath, 'utf8');
    expect(source).toContain("key: 'Content-Security-Policy'");
  });

  it('enforces max password length on loginSchema and 72-byte UTF-8 limit on registerSchema', () => {
    // 1. loginSchema must reject oversized passwords (> 128 chars) to prevent bcrypt DoS
    const hugePasswordLogin = loginSchema.safeParse({
      email: 'student@example.test',
      password: 'a'.repeat(500),
    });
    expect(hugePasswordLogin.success).toBe(false);

    // 2. registerSchema must reject passwords exceeding 72 UTF-8 bytes (e.g. 73 ASCII chars or 19 4-byte emojis = 76 bytes)
    const ascii73Register = registerSchema.safeParse({
      name: 'Alice',
      email: 'alice@example.test',
      password: 'a'.repeat(73),
    });
    expect(ascii73Register.success).toBe(false);

    const emoji76BytesRegister = registerSchema.safeParse({
      name: 'Alice',
      email: 'alice@example.test',
      password: '😀'.repeat(19),
    });
    expect(emoji76BytesRegister.success).toBe(false);

    // Valid <= 72-byte passwords must still succeed
    expect(
      registerSchema.safeParse({
        name: 'Alice',
        email: 'alice@example.test',
        password: '😀'.repeat(18), // 72 UTF-8 bytes
      }).success
    ).toBe(true);
  });

  it('restricts profilePatchSchema avatar to safe https, relative path, or image data URLs', () => {
    // Reject javascript:, data:text/html, data:image/svg+xml, and CSS injection payloads
    for (const unsafeAvatar of [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4=',
      'https://example.com/a.png");background:url("https://evil.test',
      '//evil.example/avatar.png',
    ]) {
      expect(
        profilePatchSchema.safeParse({ name: 'Alex', avatar: unsafeAvatar }).success
      ).toBe(false);
    }

    // Preserve legitimate https URLs, relative paths, data:image/(png|jpeg|webp|gif);base64, empty string, and null
    for (const validAvatar of [
      'https://api.dicebear.com/7.x/bottts/svg?seed=CatGuru&backgroundColor=b6e3f4',
      '/images/alex.webp',
      'data:image/png;base64,aGVsbG8=',
      'data:image/webp;base64,aGVsbG8=',
      '',
      null,
    ]) {
      expect(
        profilePatchSchema.safeParse({ name: 'Alex', avatar: validAvatar }).success
      ).toBe(true);
    }
  });

  it('guards adminUsers.controller getUsers against array query parameter type confusion (?search[]=a&sort[]=-name)', async () => {
    mockUsersFind.mockReturnValueOnce({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    });
    mockUsersCountDocuments.mockResolvedValueOnce(0);

    const req = {
      query: {
        search: ['injected-array'],
        sort: ['-name'],
        status: ['active'],
        role: ['admin'],
      },
    };
    const res = createMockRes();

    await getUsers(req, res);

    // Must not crash with 500 TypeError: search.trim is not a function
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      users: [],
      total: 0,
    });
  });

  it('redacts internal 500 error messages in adminUsers.controller when NODE_ENV is production', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      mockUsersCountDocuments.mockRejectedValueOnce(
        new Error('MongoServerError: connection string leak mongodb+srv://admin:secret@cluster')
      );
      const res = createMockRes();
      await getDashboardStats({}, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Internal server error');
      expect(res.body.error).not.toContain('mongodb+srv://');
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
  });
});
