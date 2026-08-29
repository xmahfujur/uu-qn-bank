import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AuditLogCategory } from '../types';

export interface LogParams {
  action: string;
  category: AuditLogCategory;
  user?: {
    uid: string;
    username?: string;
    displayName?: string;
    email?: string;
    role?: string;
  };
  performedByUid?: string;
  performedByName?: string;
  performedByEmail?: string;
  performedByRole?: string;
  details: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, any>;
}

/**
 * Automatically creates an audit log entry in Firestore whenever an Admin or Moderator
 * modifies or actions items (approvals, deletions, role updates, bans, hierarchy changes, etc.).
 */
export async function recordAuditLog(params: LogParams): Promise<string | null> {
  try {
    const uid = params.performedByUid || params.user?.uid || 'system';
    const name = params.performedByName || params.user?.username || params.user?.displayName || 'Staff Member';
    const email = params.performedByEmail || params.user?.email || '';
    const role = params.performedByRole || params.user?.role || 'admin';

    const docRef = await addDoc(collection(db, 'audit_logs'), {
      action: params.action,
      category: params.category,
      performedByUID: uid,
      performedByName: name,
      performedByEmail: email,
      performedByRole: role,
      details: params.details,
      targetId: params.targetId || '',
      targetName: params.targetName || '',
      metadata: params.metadata || {},
      timestamp: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error('Failed to write audit log:', error);
    return null;
  }
}
