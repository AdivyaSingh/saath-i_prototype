// src/firebase.js
// Firebase initialization — connects student app to teacher dashboard via Firestore.
// API keys are safe to expose in client-side code (Firebase security rules handle access control).

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCGTOd2vvYexbVJYPAkJq5SZ8urFuPyyDk",
  authDomain: "saath-i-prototype.firebaseapp.com",
  projectId: "saath-i-prototype",
  storageBucket: "saath-i-prototype.firebasestorage.app",
  messagingSenderId: "757238344923",
  appId: "1:757238344923:web:099aea00a421365302f0fe",
  measurementId: "G-HXL65B8N6L",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── COLLECTIONS ──────────────────────────────────────────────────────────────
const studentsCol = collection(db, 'students');

// ─── WRITE: Save or update a student document ────────────────────────────────
export async function saveStudentToFirebase(studentData) {
  try {
    const studentId = studentData.id || `student_${Date.now()}`;
    const docRef = doc(db, 'students', studentId);
    await setDoc(docRef, {
      ...studentData,
      id: studentId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return studentId;
  } catch (err) {
    console.error('Firebase save error:', err);
    return null;
  }
}

// ─── WRITE: Update screening results for a student ───────────────────────────
export async function saveScreeningResults(studentId, screeningResults, telemetry) {
  try {
    const docRef = doc(db, 'students', studentId);
    await updateDoc(docRef, {
      screeningResults,
      telemetry,
      screenedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('Firebase screening save error:', err);
    return false;
  }
}

// ─── WRITE: Update activity progress ─────────────────────────────────────────
export async function updateStudentProgress(studentId, updates) {
  try {
    const docRef = doc(db, 'students', studentId);
    await updateDoc(docRef, {
      ...updates,
      lastActive: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('Firebase progress update error:', err);
    return false;
  }
}

// ─── READ: Subscribe to all students (real-time) ─────────────────────────────
// Returns an unsubscribe function. Calls `onUpdate(students[])` on every change.
export function subscribeToStudents(onUpdate) {
  const q = query(studentsCol, orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const students = [];
    snapshot.forEach((doc) => {
      students.push({ id: doc.id, ...doc.data() });
    });
    onUpdate(students);
  }, (err) => {
    console.error('Firebase subscription error:', err);
  });
}

// ─── CONNECTION STATE: Simulate connection monitor ───────────────────────────
export function subscribeToConnectionState(callback) {
  // Firestore web SDK doesn't expose a simple .info/connected ref.
  // Using navigator.onLine + window events for the MVP.
  const handleOffline = () => callback('offline');
  const handleOnline = () => callback('online');

  window.addEventListener('offline', handleOffline);
  window.addEventListener('online', handleOnline);

  // Initial state
  callback(typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline');

  return () => {
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('online', handleOnline);
  };
}

export { db };
