// =====================================
// cloud.js – Firestore Cloud Sync
// =====================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDXsrypUfViIDCdK5Bs0H-P-J9KXYONajU",
  authDomain: "umar-tools-27994.firebaseapp.com",
  projectId: "umar-tools-27994",
  storageBucket: "umar-tools-27994.firebasestorage.app",
  messagingSenderId: "269972336658",
  appId: "1:269972336658:web:0fbcd8ecd1047b888e68cb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function saveCloudScript(user, script) {
  const id = script.id || Date.now().toString();
  await setDoc(doc(db, "users", user.uid, "scripts", id), {
    id,
    title: script.title,
    text: script.text,
    updatedAt: Date.now()
  });
  return id;
}

export async function loadCloudScripts(user) {
  const snap = await getDocs(collection(db, "users", user.uid, "scripts"));
  return snap.docs.map(d => d.data());
}

export async function deleteCloudScript(user, id) {
  await deleteDoc(doc(db, "users", user.uid, "scripts", id));
}
