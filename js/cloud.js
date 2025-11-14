import { app } from './firebase.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const db = getFirestore(app);

export async function saveCloudScript(user, script) {
  const id = script.id || Date.now().toString();
  await setDoc(doc(db, "users", user.uid, "scripts", id), {
    id,
    title: script.title,
    text: script.text,
    updatedAt: Date.now()
  });
}

export async function loadCloudScripts(user) {
  const snap = await getDocs(collection(db, "users", user.uid, "scripts"));
  return snap.docs.map(d => d.data());
}

export async function deleteCloudScript(user, id) {
  await deleteDoc(doc(db, "users", user.uid, "scripts", id));
}
