/* Firebase Auth 初期化と簡単なUI制御（compat） */
// TODO: 自分のfirebaseConfigに置き換え
const firebaseConfig = {
  apiKey: "AIzaSyDyL4pKx81YoOzhOVLNXxAhmgOCIXFnWN8",
  authDomain: "visual-physics-lab.firebaseapp.com",
  projectId: "visual-physics-lab",
  storageBucket: "visual-physics-lab.firebasestorage.app",
  messagingSenderId: "231263141383",
  appId: "1:231263141383:web:aa3017dd4974e9ed0434a2",
  measurementId: "G-ERYXZWHVER"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// ナビのUI（ボタンがあれば制御）
function bindAuthUI(){
  const loginBtn  = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userInfo  = document.getElementById("userInfo");

  if (!loginBtn || !logoutBtn || !userInfo) return;

  loginBtn.onclick = () => auth.signInWithPopup(provider).catch(console.error);
  logoutBtn.onclick = () => auth.signOut().catch(console.error);

  auth.onAuthStateChanged(user => {
    if (user) {
      loginBtn.style.display = "none";
      logoutBtn.style.display = "";
      userInfo.textContent = user.displayName || user.email || "(signed in)";
    } else {
      loginBtn.style.display = "";
      logoutBtn.style.display = "none";
      userInfo.textContent = "";
    }
  });
}
document.addEventListener("DOMContentLoaded", bindAuthUI);
