(function () {
  document
    .querySelector('.link-btn[href*="ForgetPassword"]')
    ?.setAttribute("href", "SuperAdminForgetPassword.html");
  const email = document.getElementById("login-email");
  const password = document.getElementById("login-pass");
  const setInvalid = (id, invalid) =>
    document.getElementById(id).classList.toggle("invalid", invalid);
  const loginButton = document.getElementById("login-submit");
  const banner = document.getElementById("login-banner");
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
        throw new Error(
          "Super Admin sign-in is not configured. Contact support.",
        );
      }
      const credential = await authSdk.signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password.value,
      );
      authenticated = true;
      const profileSnapshots = await Promise.all(
        ["adminUser", "users"].map((collectionName) =>
          firestore.getDoc(
            firestore.doc(firebase.db, collectionName, credential.user.uid),
          ),
        ),
      );
      const profile = profileSnapshots
        .filter((snapshot) => snapshot.exists())
        .map((snapshot) => snapshot.data())
        .find(
          (candidate) =>
            String(candidate.role || candidate.userRole || "")
              .trim()
              .toLowerCase()
              .replace(/\s+/g, "") === "superadmin",
        );
      if (!profile) {
        await authSdk.signOut(auth);
        authenticated = false;
        throw new Error("These credentials are not for a Super Admin account.");
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
      localStorage.setItem(
        "recovibeAdminProfile",
        JSON.stringify({
          ...profile,
          uid: credential.user.uid,
          role: "Super Admin",
        }),
      );
      localStorage.setItem("recovibeAdminId", normalizedEmail);
      window.location.assign("SuperAdminDashboard.html");
    } catch (error) {
      if (authenticated && auth) {
        try {
          const authSdk =
            await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
          await authSdk.signOut(auth);
        } catch (signOutError) {
          console.error(
            "Unable to clear unverified Super Admin session:",
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
