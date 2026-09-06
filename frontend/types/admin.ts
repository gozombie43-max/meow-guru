export type UserRole = 'user' | 'student' | 'moderator' | 'admin' | 'superadmin';
export type UserStatus = 'active' | 'suspended' | 'banned';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  authProvider: 'local' | 'google';
  examPreferences?: string[];

  progress?: Record<string, { attempted: number; correct: number }>;
  studyTime?: number;

  subscription?: {
    plan: 'free' | 'premium';
    status: 'active' | 'expired' | 'cancelled';
  };

  notifications?: {
    enabled: boolean;
    fcmTokens: string[];
  };

  lastLoginAt?: string;
  lastActiveDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminUserStats {
  questionsAttempted: number;
  correctAnswers: number;
  accuracy: number;
  mockTestsCompleted: number;
  currentStreak: number;
  studyTimeMinutes: number;
  topTopics: { topic: string; attempted: number; correct: number; accuracy: number }[];
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeToday: number;
  newThisWeek: number;
  suspendedCount: number;
}

export interface AdminUsersQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus | '';
  role?: UserRole | '';
  sort?: string;
}
