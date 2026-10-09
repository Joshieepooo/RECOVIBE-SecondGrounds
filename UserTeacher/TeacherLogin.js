(function () {
  const email = document.getElementById("login-email");
  const password = document.getElementById("login-pass");
  const banner = document.getElementById("login-banner");
  const loginButton = document.getElementById("login-submit");
  const setInvalid = (id, invalid) =>
    document.getElementById(id).classList.toggle("invalid", invalid);

  loginButton.addEventListener("click", async () => {
    const normalizedEmail = email.value.trim().toLowerCase();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    setInvalid("field-email", !validEmail);
    setInvalid("field-pass", !password.value);
    banner.classList.remove("show");
    if (!validEmail || !password.value) {
      banner.textContent = "Enter a valid email and password.";
      banner.classList.add("show");
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";
    let auth;
    let authenticated = false;
    try {
      const [firebase, authSdk, firestore] = await Promise.all([
        import("../UserStudent/firebaseConfig.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
      ]);
      auth = firebase.auth;
      if (!firebase.isFirebaseConfigured || !auth || !firebase.db) {
        throw new Error("Teacher sign-in is not configured. Contact support.");
      }
      const credential = await authSdk.signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password.value,
      );
      authenticated = true;
      const profileSnapshot = await firestore.getDoc(
        firestore.doc(firebase.db, "adminUser", credential.user.uid),
      );
      const profile = profileSnapshot.exists() ? profileSnapshot.data() : null;
      if (
        String(profile?.role || "")
          .trim()
          .toLowerCase() !== "teacher"
      ) {
        await authSdk.signOut(auth);
        authenticated = false;
        throw new Error("These credentials are not for a Teacher account.");
      }
      if (
        String(profile.status || "")
          .trim()
          .toLowerCase() === "suspended"
      ) {
        await authSdk.signOut(auth);
        authenticated = false;
        throw new Error("This account is suspended. Contact an administrator.");
      }
      const teacher = {
        ...profile,
        uid: credential.user.uid,
        name:
          profile.fullName ||
          profile.name ||
          credential.user.displayName ||
          "Teacher",
        email: normalizedEmail,
        role: "Teacher",
      };
      localStorage.setItem("recovibeCurrentTeacher", JSON.stringify(teacher));
      localStorage.setItem("recovibeTeacherId", normalizedEmail);
      window.location.assign("TeacherDashBoard.html");
    } catch (error) {
      if (authenticated && auth) {
        try {
          const authSdk =
            await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
          await authSdk.signOut(auth);
        } catch (signOutError) {
          console.error(
            "Unable to clear unverified Teacher session:",
            signOutError,
          );
        }
      }
      banner.textContent = error?.code?.startsWith("auth/")
        ? "Incorrect email or password."
        : error?.message || "Unable to sign in right now. Please try again.";
      banner.classList.add("show");
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Sign in";
    }
  });

  document.getElementById("pass-toggle").addEventListener("click", function () {
    const visible = password.type === "password";
    password.type = visible ? "text" : "password";
    this.setAttribute(
      "aria-label",
      visible ? "Hide password" : "Show password",
    );
    this.setAttribute("aria-pressed", String(visible));
  });
})();
