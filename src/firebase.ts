import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setDoc, collection, addDoc, query, orderBy, limit, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enable persistent local cache to support robust offline operations
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);

export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Error Handling Utility
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function logFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Distinguish between authorization/permissions errors (which must be logged for debugging)
  // and network/offline errors (which Firestore resolves internally, and should not crash the app).
  const isPermissionError = errorMessage.toLowerCase().includes('permission') || 
                            errorMessage.toLowerCase().includes('insufficient') ||
                            (error && typeof error === 'object' && 'code' in error && (error as any).code === 'permission-denied');
  
  const isOfflineError = errorMessage.toLowerCase().includes('offline') || 
                         errorMessage.toLowerCase().includes('unavailable') ||
                         errorMessage.toLowerCase().includes('could not reach') ||
                         (error && typeof error === 'object' && 'code' in error && (error as any).code === 'unavailable');

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };

  if (isOfflineError && !isPermissionError) {
    console.warn('Firestore is operating in offline mode:', JSON.stringify(errInfo));
    return errInfo;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const isPermissionError = errorMessage.toLowerCase().includes('permission') || 
                            errorMessage.toLowerCase().includes('insufficient') ||
                            (error && typeof error === 'object' && 'code' in error && (error as any).code === 'permission-denied');
  
  const isOfflineError = errorMessage.toLowerCase().includes('offline') || 
                         errorMessage.toLowerCase().includes('unavailable') ||
                         errorMessage.toLowerCase().includes('could not reach') ||
                         (error && typeof error === 'object' && 'code' in error && (error as any).code === 'unavailable');

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };

  if (isOfflineError && !isPermissionError) {
    console.warn('Firestore is operating in offline mode:', JSON.stringify(errInfo));
    return;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection Test
async function testConnection() {
  try {
    // Attempt to reach the server once to verify initial connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline') || error.message.includes('unavailable') || error.message.includes('Could not reach')) {
        console.warn("Firestore connectivity warning: The client may be offline or the service is temporarily unavailable. Firestore will continue to attempt reconnections in the background.");
      } else if (error.message.includes('Missing or insufficient permissions')) {
        // If we get a permission error, it means we successfully reached Firestore!
        console.log("Firestore connected successfully.");
      } else {
        console.error("Firestore initialization error:", error.message);
      }
    }
  }
}
// testConnection is kept declared for debugging without automatic invocation on module load.

/**
 * Verifica se o usuário autenticado possui a Custom Claim 'specialist: true'.
 * Esta função é utilizada EXCLUSIVAMENTE para controle de visibilidade da interface (UI).
 * A autorização definitiva e inviolável é executada pelas regras do Firestore no servidor.
 */
export async function hasSpecialistAccess(user: FirebaseUser | null, forceRefresh: boolean = false): Promise<boolean> {
  if (!user) return false;
  
  // Administrador fixo do sistema
  if (user.email && user.email.toLowerCase() === 'cassiojosems@gmail.com') {
    return true;
  }

  try {
    const tokenResult = await user.getIdTokenResult(forceRefresh);
    return tokenResult.claims.specialist === true || tokenResult.claims.admin === true;
  } catch (error) {
    console.warn("Aviso ao verificar Custom Claims de especialista:", error);
    return false;
  }
}
