(function () {
  function setupSpotCardBookmarkDefaults() {
    document.querySelectorAll(".spot-bookmark").forEach((button) => {
      const icon = button.querySelector(".fa-bookmark");

      if (!icon) {
        return;
      }

      if (!button.dataset.savedCollections) {
        button.dataset.savedCollections = JSON.stringify([]);
      }

      icon.classList.remove("fa-solid");
      icon.classList.add("fa-regular");
    });
  }

  function initSpotCards() {
    setupSpotCardBookmarkDefaults();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSpotCards);
  } else {
    initSpotCards();
  }
})();