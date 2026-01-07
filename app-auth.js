// app-auth.js
import { FIREBASE_CONFIG, ADMIN_EMAIL } from "./config.js";
import { toast, $ } from "./app-common.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

let heartbeatTimer = null;

export function isAdminEmail(user){
  const email = (user?.email || "").toLowerCase();
  return email === ADMIN_EMAIL.toLowerCase();
}

export async function ensureUserDoc(user){
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      role: isAdminEmail(user) ? "admin" : "driver",
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    }, {merge:true});
  }else{
    await setDoc(ref, {
      email: user.email || null,
      displayName: user.displayName || null,
      lastLoginAt: serverTimestamp(),
    }, {merge:true});
  }
}

export async function startHeartbeat(user){
  const sref = doc(db, "sessions", user.uid);
  await setDoc(sref, {
    uid: user.uid,
    email: user.email || null,
    updatedAt: serverTimestamp(),
    userAgent: navigator.userAgent
  }, {merge:true});

  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(async ()=>{
    try{
      await setDoc(sref, { updatedAt: serverTimestamp() }, {merge:true});
    }catch(e){}
  }, 60*1000);
}

export async function stopHeartbeat(user){
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  if(!user) return;
  const sref = doc(db, "sessions", user.uid);
  try{
    await setDoc(sref, { updatedAt: serverTimestamp() }, {merge:true});
  }catch(e){}
}

export function bindAuthUI(){
  // ページにauthフォームがある場合だけ動く
  const loginBtn = $("loginBtn");
  const signupBtn = $("signupBtn");
  const logoutBtn = $("logoutBtn");

  if(loginBtn){
    loginBtn.addEventListener("click", async (e)=>{
      e.preventDefault();
      const email = ($("email")?.value||"").trim();
      const pass = ($("pass")?.value||"").trim();
      if(!email || !pass) return toast("メールとパスワードを入力してください");
      try{
        await signInWithEmailAndPassword(auth, email, pass);
        toast("ログインしました", true);
      }catch(err){
        toast(err?.message || "ログインに失敗しました");
      }
    });
  }

  if(signupBtn){
    signupBtn.addEventListener("click", async (e)=>{
      e.preventDefault();
      const email = ($("email")?.value||"").trim();
      const pass = ($("pass")?.value||"").trim();
      if(!email || !pass) return toast("メールとパスワードを入力してください");
      try{
        await createUserWithEmailAndPassword(auth, email, pass);
        toast("登録しました。すぐ使えます", true);
      }catch(err){
        toast(err?.message || "登録に失敗しました");
      }
    });
  }

  if(logoutBtn){
    logoutBtn.addEventListener("click", async (e)=>{
      e.preventDefault();
      try{
        await stopHeartbeat(auth.currentUser);
        await signOut(auth);
        toast("ログアウトしました", true);
      }catch(err){
        toast(err?.message || "ログアウトに失敗しました");
      }
    });
  }
}

export function watchAuth(onIn, onOut){
  onAuthStateChanged(auth, async (user)=>{
    if(!user){
      await stopHeartbeat(null);
      onOut?.();
      return;
    }
    await ensureUserDoc(user);
    await startHeartbeat(user);
    onIn?.(user);
  });
}

export function goIfNotLoggedIn(){
  if(!auth.currentUser){
    location.href = "./index.html";
  }
}
