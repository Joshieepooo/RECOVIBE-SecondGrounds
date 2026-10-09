import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  auth,
  db,
  isFirebaseConfigured,
} from "../UserStudent/firebaseConfig.js";

function initials(name) {
  return (
    String(name)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "T"
  );
}

if (isFirebaseConfigured && auth && db) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    let userData = {};
    try {
      let profileSnapshot = await getDoc(doc(db, "adminUser", user.uid));
      if (!profileSnapshot.exists()) {
        profileSnapshot = await getDoc(doc(db, "users", user.uid));
      }
      if (profileSnapshot.exists()) userData = profileSnapshot.data();
    } catch (error) {
      console.error("Unable to load teacher profile:", error);
    }

    const name =
      userData.fullName ||
      userData.name ||
      user.displayName ||
      user.email ||
      "Teacher";
    const subtext = userData.organization || userData.role || user.email || "";
    const nameElement = document.getElementById("sidebarUserName");
    const subtextElement = document.getElementById("sidebarUserSubtext");
    const avatarElement = document.getElementById("userAvatarInitials");
    if (nameElement) nameElement.textContent = name;
    if (subtextElement) subtextElement.textContent = subtext;
    if (avatarElement) avatarElement.textContent = initials(name);
  });
}
