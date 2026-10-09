(() => {
  "use strict";
  document.querySelectorAll("[data-portal-role]").forEach((option) => {
    option.addEventListener("click", (event) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      localStorage.setItem("recovibeSelectedPortal", option.dataset.portalRole);
      document.body.classList.add("is-leaving");
    });
  });
})();
