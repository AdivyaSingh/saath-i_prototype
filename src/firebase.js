// src/firebase.js
// Firebase initialization — connects student app to teacher dashboard via Firestore.
// Student and teacher identity is managed with class-code + PIN authentication.
// NOTE: PINs are stored as plaintext for the prototype. Hash them (e.g. bcrypt) in production.

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  where,
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
const classesCol  = collection(db, 'classes');   // eslint-disable-line no-unused-vars
const teachersCol = collection(db, 'teachers');  // eslint-disable-line no-unused-vars

// ─── SEED: Ensure SCH001 demo class + teacher exist in Firestore ──────────────
// Called once on app mount. Safe to call repeatedly (checks before writing).
export async function seedDemoData() {
  try {
    const classRef = doc(db, 'classes', 'SCH001');
    const classSnap = await getDoc(classRef);
    if (!classSnap.exists()) {
      await setDoc(classRef, {
        id: 'SCH001',
        teacherName: 'Ms. Lata',
        schoolName: 'Team: CaseLyticals Demo School',
        createdAt: serverTimestamp(),
      });
    }
    const teacherRef = doc(db, 'teachers', 'SCH001');
    const teacherSnap = await getDoc(teacherRef);
    if (!teacherSnap.exists()) {
      await setDoc(teacherRef, {
        id: 'SCH001',
        name: 'Ms. Lata',
        classCode: 'SCH001',
        schoolName: 'Team: CaseLyticals Demo School',
        pin: '1234',
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error('[Seed] Error seeding demo data:', err);
  }
}

// ─── CLASS CODE VALIDATION ────────────────────────────────────────────────────
// Returns the class document {id, teacherName, schoolName} or null if not found.
export async function getClassByCode(classCode) {
  try {
    const snap = await getDoc(doc(db, 'classes', classCode.toUpperCase().trim()));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    return null;
  } catch (err) {
    console.error('[Firebase] getClassByCode error:', err);
    return null;
  }
}

// ─── STUDENT ID GENERATION ────────────────────────────────────────────────────
// Converts a name to a URL-safe slug: "Arjun Kumar" → "arjun-kumar"
function slugify(name) {
  return name.trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Generates a unique Firestore document ID in the form: name-classcode[-N]
// e.g. "arjun-sch001", "arjun-sch001-2", "arjun-sch001-3"
// NOTE: Not race-condition-safe for exact-simultaneous registrations (acceptable for prototype).
export async function generateUniqueStudentId(name, classCode) {
  const base = `${slugify(name)}-${classCode.toLowerCase()}`;
  const snap = await getDoc(doc(db, 'students', base));
  if (!snap.exists()) return base;
  let serial = 2;
  while (serial <= 99) {
    const candidate = `${base}-${serial}`;
    const s = await getDoc(doc(db, 'students', candidate));
    if (!s.exists()) return candidate;
    serial++;
  }
  // Extremely unlikely fallback
  return `${base}-${Date.now().toString().slice(-6)}`;
}

// ─── STUDENT LOOKUP ───────────────────────────────────────────────────────────
// Returns all students in a class whose display name matches the query.
// Used during registration to detect duplicates and during login to find the user.
export async function findStudentsByName(name, classCode) {
  try {
    const q = query(
      studentsCol,
      where('classCode', '==', classCode.toUpperCase().trim()),
      where('name', '==', name.trim())
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[Firebase] findStudentsByName error:', err);
    return [];
  }
}

// Returns a single student document by its Firestore ID, or null.
export async function getStudentById(studentId) {
  try {
    const snap = await getDoc(doc(db, 'students', studentId));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    return null;
  } catch (err) {
    console.error('[Firebase] getStudentById error:', err);
    return null;
  }
}

// Checks that the provided PIN matches the stored PIN for a given student ID.
export async function verifyStudentPin(studentId, pin) {
  try {
    const student = await getStudentById(studentId);
    return !!(student && student.pin === pin);
  } catch (err) {
    return false;
  }
}

// ─── WRITE: Save or update a student document ─────────────────────────────────
// Requires studentData.id to be set — will throw if missing.
export async function saveStudentToFirebase(studentData) {
  try {
    const studentId = studentData.id;
    if (!studentId) throw new Error('saveStudentToFirebase: id is required');
    const docRef = doc(db, 'students', studentId);
    await setDoc(docRef, {
      ...studentData,
      id: studentId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return studentId;
  } catch (err) {
    console.error('[Firebase] saveStudentToFirebase error:', err);
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
    console.error('[Firebase] saveScreeningResults error:', err);
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
    console.error('[Firebase] updateStudentProgress error:', err);
    return false;
  }
}

// ─── TEACHER FUNCTIONS ────────────────────────────────────────────────────────

// Generates a class code from school name + 3 random digits, e.g. "GPS123".
// Retries until a unique code is found (max 10 attempts).
export async function generateClassCode(schoolName) {
  const prefix = (schoolName || 'SCH')
    .replace(/[aeiou\s]/gi, '')
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 3)
    .toUpperCase();
  const safePrefix = prefix || 'SCH';
  for (let i = 0; i < 10; i++) {
    const digits = String(Math.floor(100 + Math.random() * 900));
    const code = `${safePrefix}${digits}`;
    const snap = await getDoc(doc(db, 'classes', code));
    if (!snap.exists()) return code;
  }
  // Fallback: timestamp-based suffix (guaranteed unique)
  return `${safePrefix}${Date.now().toString().slice(-5)}`;
}

// Registers a new teacher. Creates both a `teachers/{classCode}` and `classes/{classCode}` doc.
// teacherData: { name, schoolName, classCode, pin }
export async function createTeacher(teacherData) {
  try {
    const { classCode } = teacherData;
    await setDoc(doc(db, 'teachers', classCode), {
      ...teacherData,
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'classes', classCode), {
      id: classCode,
      teacherName: teacherData.name,
      schoolName: teacherData.schoolName,
      createdAt: serverTimestamp(),
    });
    return classCode;
  } catch (err) {
    console.error('[Firebase] createTeacher error:', err);
    return null;
  }
}

// Verifies a teacher's PIN by classCode. Returns the teacher object on success, null otherwise.
export async function verifyTeacherPin(classCode, pin) {
  try {
    const snap = await getDoc(doc(db, 'teachers', classCode.toUpperCase().trim()));
    if (!snap.exists()) return null;
    const teacher = { id: snap.id, ...snap.data() };
    return teacher.pin === pin ? teacher : null;
  } catch (err) {
    console.error('[Firebase] verifyTeacherPin error:', err);
    return null;
  }
}

// ─── READ: Subscribe to students for a specific class ────────────────────────
// classCode is required. Only returns students whose classCode field matches.
// Returns an unsubscribe function.
// NOTE: The filtered query uses only `where` (no orderBy) to avoid needing a
// Firestore composite index. Sorting is done client-side after the snapshot.
export function subscribeToStudents(onUpdate, classCode) {
  const q = classCode
    ? query(studentsCol, where('classCode', '==', classCode.toUpperCase().trim()))
    : query(studentsCol, orderBy('updatedAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    let students = [];
    snapshot.forEach((d) => students.push({ id: d.id, ...d.data() }));
    // Sort client-side by updatedAt descending when using the filtered query.
    if (classCode) {
      students = students.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? a.updatedAt ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? b.updatedAt ?? 0;
        return tb - ta;
      });
    }
    onUpdate(students);
  }, (err) => {
    console.error('[Firebase] subscribeToStudents error:', err);
  });
}


// ─── CONNECTION STATE ─────────────────────────────────────────────────────────
// Uses browser online/offline events. Firestore web SDK handles reconnection internally.
export function subscribeToConnectionState(callback) {
  const handleOffline = () => callback('offline');
  const handleOnline  = () => callback('online');
  window.addEventListener('offline', handleOffline);
  window.addEventListener('online',  handleOnline);
  callback(typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline');
  return () => {
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('online',  handleOnline);
  };
}

export { db };
