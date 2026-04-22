(function () {
  function setupSpotCardDetailNavigation() {
    const spotsPanel = document.getElementById("spotsPanel");
    const spotDetailPanel = document.getElementById("spotDetailPanel");
    const closeSpotDetailButton = document.getElementById(
      "closeSpotDetailButton",
    );
    const spotDetailTitle = document.getElementById("spotDetailTitle");
    const spotDetailImage = document.getElementById("spotDetailImage");
    const spotDetailPrice = document.getElementById("spotDetailPrice");
    const spotDetailRatingValue = document.getElementById(
      "spotDetailRatingValue",
    );
    const spotDetailRatingCount = document.getElementById(
      "spotDetailRatingCount",
    );

    if (
      !spotsPanel ||
      !spotDetailPanel ||
      !closeSpotDetailButton ||
      !spotDetailTitle ||
      !spotDetailImage ||
      !spotDetailPrice ||
      !spotDetailRatingValue ||
      !spotDetailRatingCount
    ) {
      return;
    }

    function showPanel(panelToShow, panelToHide) {
      panelToHide.classList.remove("right-panel--active");
      panelToHide.classList.add("right-panel--hidden");

      panelToShow.classList.remove("right-panel--hidden");
      panelToShow.classList.add("right-panel--active");
    }

    document.querySelectorAll(".spot-card--clickable").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (
          event.target.closest(".spot-bookmark") ||
          event.target.closest(".spot-delete") ||
          event.target.closest(".icon-button-base")
        ) {
          return;
        }

        spotDetailTitle.textContent = card.dataset.spotName || "Spot";
        spotDetailImage.src = card.dataset.spotImage || "";
        spotDetailImage.alt = card.dataset.spotName || "Spot image";
        spotDetailPrice.textContent = card.dataset.spotPrice || "";
        spotDetailRatingValue.textContent = card.dataset.spotRating || "0";
        spotDetailRatingCount.textContent =
          card.dataset.spotRatingCount || "(0)";

        showPanel(spotDetailPanel, spotsPanel);
      });
    });

    closeSpotDetailButton.addEventListener("click", () => {
      showPanel(spotsPanel, spotDetailPanel);
    });
  }

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
    setupSpotCardDetailNavigation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSpotCards);
  } else {
    initSpotCards();
  }
})();
