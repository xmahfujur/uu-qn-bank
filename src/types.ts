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
