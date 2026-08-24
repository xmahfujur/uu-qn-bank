export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  photoURL: string;
  createdAt: string;
  role: 'super_admin' | 'moderator' | 'user';
  uploadCount: number;
  likesReceived: number;
}

export interface Department {
  id: string;
  name: string;
  code: string; // e.g. CSE, EEE
  createdAt: string;
}

export interface Batch {
  id: string;
  departmentId: string;
  name: string; // e.g. Batch 60
  createdAt: string;
}

export interface Semester {
  id: string;
  batchId: string;
  name: string; // e.g. Spring 2026
  createdAt: string;
}

export type ExamType = 'Mid' | 'Final';

export interface QuestionPaper {
  id: string;
  courseCode: string;
  courseName: string;
  teacher?: string;
  imageUrl: string;
  imageUrls?: string[];
  deleteUrls?: string[]; // ImgBB delete URLs for auto cleanup
  pdfUrl?: string;
  departmentId: string;
  batchId: string;
  semesterId: string;
  examType: ExamType;
  uploadedByUID: string;
  uploadedByUsername: string;
  uploadedAt: string;
  reportCount: number;
  downloads: number;
  views: number;
  likes: number;
  likedBy?: string[]; // array of user UIDs
  bookmarks?: string[]; // array of user UIDs
  status?: 'pending' | 'published' | 'rejected';
  verifiedByUID?: string;
  verifiedByUsername?: string;
  verificationFeedback?: string;
}

export interface Report {
  id: string;
  questionId: string;
  courseCode: string;
  courseName: string;
  reportedByUID: string;
  reportedByUsername: string;
  reason: 'Wrong paper' | 'Spam' | 'Duplicate' | 'Broken Link' | 'Other';
  description: string;
  reportedAt: string;
}

export interface Bookmark {
  id: string;
  questionId: string;
  userId: string;
  bookmarkedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  type: 'upload' | 'like' | 'bookmark' | 'report';
  details: string;
  timestamp: string;
}

export interface Faculty {
  id: string;
  name: string;
  designation: string;
  departmentId: string; // e.g. linked to Department.id
  createdAt: string;
  totalRatingSum: number;
  totalRatingCount: number;
  averageRating: number; // calculated as totalRatingSum / totalRatingCount
  imageUrl?: string;
  phone?: string;
  email?: string;
}

export interface FacultyRating {
  id: string; // generated as ${userId}_${facultyId}
  userId: string;
  username: string;
  facultyId: string;
  rating: number; // 1 to 5
  createdAt: string;
}

export interface AcademicEvent {
  id: string;
  title: string;
  type: 'Mid' | 'Final' | 'Class Test' | 'Assignment' | 'Holiday' | 'Result' | 'Registration';
  departmentId?: string; // 'all' or specific department ID
  startDate: string; // ISO date string or YYYY-MM-DD
  endDate?: string; // ISO date string or YYYY-MM-DD
  description?: string;
  createdAt: string;
  createdByUID?: string;
  createdByUsername?: string;
}

export type AuditLogCategory = 'Papers' | 'Reports' | 'Users' | 'Hierarchy' | 'Faculty' | 'Events';

export interface AuditLog {
  id: string;
  action: string;
  category: AuditLogCategory;
  performedByUID: string;
  performedByName: string;
  performedByEmail?: string;
  performedByRole: string;
  details: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

