import { auth } from "./config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

export function initAuth() {
  document.getElementById("loginBtn").onclick = async () => {
    await signInWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );
  };

  document.getElementById("signupBtn").onclick = async () => {
    await createUserWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );
  };

  document.getElementById("logoutBtn").onclick = () => signOut(auth);

  onAuthStateChanged(auth, user => {
    if (user) {
      document.body.classList.add("logged-in");
      document.getElementById("userEmail").textContent = user.email;
    } else {
      document.body.classList.remove("logged-in");
    }
  });
}
