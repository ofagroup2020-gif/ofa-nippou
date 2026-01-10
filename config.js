import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBe8GHuQepazPDF-dc9XvGlqVNMsdV913E",
  authDomain: "ofatenkoapp.firebaseapp.com",
  projectId: "ofatenkoapp",
  storageBucket: "ofatenkoapp.appspot.com",
  messagingSenderId: "6840450594",
  appId: "1:6840450594:web:441bbb4e2e4be061a6547b"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
