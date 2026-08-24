import { 
  doc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  increment 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { deleteImagesFromImgBB } from './imageUploader';
import { QuestionPaper } from '../types';

export interface DeleteQuestionResult {
  success: boolean;
  error?: string;
  imgbbDeletedCount?: number;
}

/**
 * Permanently deletes a question paper document from Firestore,
 * automatically deletes its uploaded image files from ImgBB,
 * cleans up associated reports, and updates the author's upload counter.
 */
export async function deleteQuestionWithImages(
  question: QuestionPaper | { 
    id: string; 
    deleteUrls?: string[]; 
    imageUrls?: string[]; 
    imageUrl?: string; 
    uploadedByUID?: string;
  }
): Promise<DeleteQuestionResult> {
  if (!question || !question.id) {
    return { success: false, error: 'Invalid question paper identifier.' };
  }

  try {
    // 1. Gather all ImgBB delete URLs & image URLs for automatic image deletion
    const deleteUrls: string[] = [];
    if (question.deleteUrls && Array.isArray(question.deleteUrls)) {
      question.deleteUrls.forEach(u => {
        if (typeof u === 'string' && u.trim() !== '') deleteUrls.push(u.trim());
      });
    }

    const imageUrls: string[] = [];
    if (question.imageUrls && Array.isArray(question.imageUrls)) {
      question.imageUrls.forEach(u => {
        if (typeof u === 'string' && u.trim() !== '') imageUrls.push(u.trim());
      });
    }
    if (question.imageUrl && typeof question.imageUrl === 'string' && question.imageUrl.trim() !== '') {
      imageUrls.push(question.imageUrl.trim());
    }

    console.log(`[Auto ImgBB Cleanup] Triggering ImgBB deletion for question ${question.id}...`, {
      deleteUrls,
      imageUrls
    });

    // 2. Dispatch ImgBB image deletion automatically in parallel
    const imgbbPromise = deleteImagesFromImgBB(deleteUrls, imageUrls).catch(err => {
      console.warn('[Auto ImgBB Cleanup] ImgBB deletion request error:', err);
      return { success: false, deletedCount: 0 };
    });

    // 3. Delete Question Document from Firestore
    await deleteDoc(doc(db, 'questions', question.id));

    // 4. Clean up any related reports for this question in Firestore
    try {
      const reportsQuery = query(collection(db, 'reports'), where('questionId', '==', question.id));
      const reportsSnapshot = await getDocs(reportsQuery);
      const deleteReportPromises = reportsSnapshot.docs.map(reportDoc => deleteDoc(doc(db, 'reports', reportDoc.id)));
      await Promise.all(deleteReportPromises);
    } catch (reportErr) {
      console.warn('Non-fatal error cleaning up reports for question:', reportErr);
    }

    // 5. Decrement the author's upload count if available
    if (question.uploadedByUID) {
      try {
        const userRef = doc(db, 'users', question.uploadedByUID);
        await updateDoc(userRef, {
          uploadCount: increment(-1)
        });
      } catch (userErr) {
        console.warn('Non-fatal error updating user upload count:', userErr);
      }
    }

    // Await ImgBB deletion outcome
    const imgbbResult = await imgbbPromise;
    console.log(`[Auto ImgBB Cleanup] Question ${question.id} and ImgBB images deleted successfully. Deleted count:`, imgbbResult?.deletedCount);

    return {
      success: true,
      imgbbDeletedCount: imgbbResult?.deletedCount || 0
    };
  } catch (err: any) {
    console.error('Error deleting question paper:', err);
    return {
      success: false,
      error: err.message || 'Failed to delete question paper.'
    };
  }
}
