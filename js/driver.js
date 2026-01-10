import { auth, db, storage } from "./config.js";
import {
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  ref, uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

export async function saveTenko(data, files) {
  const user = auth.currentUser;
  if (!user) throw "未ログイン";

  const docRef = await addDoc(collection(db, "tenko"), {
    uid: user.uid,
    email: user.email,
    ...data,
    createdAt: serverTimestamp()
  });

  for (const f of files) {
    const r = ref(storage, `tenko/${docRef.id}/${f.name}`);
    await uploadBytes(r, f);
  }

  alert("保存完了");
}
