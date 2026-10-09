(function () {
  document.querySelectorAll("a.logout").forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      if (link.getAttribute("aria-busy") === "true") return;

      link.setAttribute("aria-busy", "true");

      try {
        const { auth } = await import("./firebaseConfig.js");
        if (auth) {
          const { signOut } =
            await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
          await signOut(auth);
        }

        localStorage.removeItem("recovibeCurrentUser");
        window.location.assign(
          new URL("StudentLogin.html", window.location.href),
        );
      } catch (error) {
        console.error("Student logout failed:", error);
        link.removeAttribute("aria-busy");
        window.alert("Could not log out. Please try again.");
      }
    });
  });

  const storedNotifications = localStorage.getItem("recovibeNotifications");
  const notifications =
    storedNotifications === null
      ? Array.from({ length: 5 }, () => ({ read: false }))
      : JSON.parse(storedNotifications);
  const unreadCount = notifications.filter((item) => !item.read).length;
  const badge = document.getElementById("navNotifBadge");
  if (!badge) return;
  badge.textContent = unreadCount;
  badge.hidden = unreadCount === 0;
})();
