(function () {
  function parseJsonData(rawValue, fallbackValue) {
    if (!rawValue) {
      return fallbackValue;
    }

    try {
      return JSON.parse(rawValue);
    } catch (error) {
      console.error("Failed to parse JSON data:", error);
      return fallbackValue;
    }
  }

  function renderStars(container, rating) {
    container.innerHTML = "";

    for (let i = 1; i <= 5; i += 1) {
      const star = document.createElement("i");
      star.classList.add("icon-star");

      if (rating >= i) {
        star.classList.add("fa-solid", "fa-star");
      } else if (rating >= i - 0.5) {
        star.classList.add("fa-solid", "fa-star-half-stroke");
      } else {
        star.classList.add("fa-regular", "fa-star");
      }

      container.appendChild(star);
    }
  }

  function renderIcons(container, icons) {
    container.innerHTML = "";

    icons.forEach((icon) => {
      const button = document.createElement("button");
      button.className = "icon-button-base";
      button.type = "button";
      button.setAttribute("data-tooltip", icon.tooltip);
      button.setAttribute("aria-label", icon.tooltip);

      const iconElement = document.createElement("i");
      icon.icon_class.split(" ").forEach((className) => {
        iconElement.classList.add(className);
      });

      button.appendChild(iconElement);
      container.appendChild(button);
    });
  }

  function createReviewStarsMarkup(rating) {
    let markup = "";

    for (let i = 1; i <= 5; i += 1) {
      if (rating >= i) {
        markup += '<i class="fa-solid fa-star icon-star"></i>';
      } else if (rating >= i - 0.5) {
        markup += '<i class="fa-solid fa-star-half-stroke icon-star"></i>';
      } else {
        markup += '<i class="fa-regular fa-star icon-star"></i>';
      }
    }

    return markup;
  }

  function createReviewCardMarkup(review) {
    return `
      <article class="review-card spot-detail-review-card" data-review-id="${review.id ?? ""}">
        <div class="review-card-top">
          <div class="review-card-meta">
            <i class="fa-solid fa-circle-user icon-review-profile"></i>
            <div class="heading-4 text-black">${review.author}</div>
          </div>

          <div class="review-card-interactions">
            <div class="spot-stars">
              ${createReviewStarsMarkup(Number(review.rating || 0))}
            </div>

            <button class="review-card-delete" type="button" aria-label="Delete review">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>

        <p class="text text-black">${review.body}</p>

        <div class="review-card-bottom">
          <div class="small text-gray">${review.date}</div>
        </div>
      </article>
    `;
  }

  function renderReviews(container, reviews) {
    if (!reviews.length) {
      container.innerHTML = `
        <div class="text text-gray">
          No reviews yet.
        </div>
      `;
      return;
    }

    container.innerHTML = reviews.map(createReviewCardMarkup).join("");
  }

  function setupSpotDetailPanel() {
    const spotsPanel = document.getElementById("spotsPanel");
    const spotDetailPanel = document.getElementById("spotDetailPanel");
    const closeSpotDetailButton = document.getElementById(
      "closeSpotDetailButton",
    );
    const shareSpotButton = document.getElementById("shareSpotButton");

    const spotDetailTitle = document.getElementById("spotDetailTitle");
    const spotDetailImage = document.getElementById("spotDetailImage");
    const spotDetailPrice = document.getElementById("spotDetailPrice");
    const spotDetailRatingValue = document.getElementById(
      "spotDetailRatingValue",
    );
    const spotDetailRatingCount = document.getElementById(
      "spotDetailRatingCount",
    );
    const spotDetailDescription = document.getElementById(
      "spotDetailDescription",
    );
    const spotDetailStars = document.getElementById("spotDetailStars");
    const spotDetailIcons = document.getElementById("spotDetailIcons");
    const spotDetailReviews = document.getElementById("spotDetailReviews");
    const writeReviewPanel = document.getElementById("writeReviewPanel");
    const writeReviewText = document.getElementById("writeReviewText");
    const requestPublicButton = document.getElementById("requestPublicButton");

    if (
      !spotsPanel ||
      !spotDetailPanel ||
      !closeSpotDetailButton ||
      !spotDetailTitle ||
      !spotDetailImage ||
      !spotDetailPrice ||
      !spotDetailRatingValue ||
      !spotDetailRatingCount ||
      !spotDetailDescription ||
      !spotDetailStars ||
      !spotDetailIcons ||
      !spotDetailReviews ||
      !writeReviewPanel ||
      !writeReviewText ||
      !requestPublicButton
    ) {
      return;
    }

    let activeSpotCard = null;

    function showPanel(panelToShow, panelToHide) {
      panelToHide.classList.remove("right-panel--active");
      panelToHide.classList.add("right-panel--hidden");

      panelToShow.classList.remove("right-panel--hidden");
      panelToShow.classList.add("right-panel--active");
    }

    function setRequestPublicButtonState(status, isOwner) {
      const normalizedStatus = String(status || "").trim().toLowerCase();

      requestPublicButton.hidden = true;
      requestPublicButton.disabled = true;
      requestPublicButton.textContent = "Request To Make Public";
      requestPublicButton.classList.remove("spot-detail-request-public--pending");

      if (!isOwner) {
        return;
      }

      if (normalizedStatus === "private") {
        requestPublicButton.hidden = false;
        requestPublicButton.disabled = false;
        return;
      }

      if (normalizedStatus === "pending") {
        requestPublicButton.hidden = false;
        requestPublicButton.disabled = true;
        requestPublicButton.textContent = "Public Request Pending";
        requestPublicButton.classList.add("spot-detail-request-public--pending");
      }
    }

    spotsPanel.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const card = event.target.closest(".spot-card--clickable");

      if (!card || !spotsPanel.contains(card)) {
        return;
      }

      if (
        event.target.closest(".spot-bookmark") ||
        event.target.closest(".spot-delete") ||
        event.target.closest(".icon-button-base")
      ) {
        return;
      }

      const name = card.dataset.spotName || "Spot";
      const image = card.dataset.spotImage || "";
      const price = card.dataset.spotPrice || "";
      const rating = Number(card.dataset.spotRating || "0");
      const ratingCount = card.dataset.spotRatingCount || "(0)";
      const status = card.dataset.spotStatus || "";
      const isOwner = card.dataset.spotIsOwner === "true";
      const description = card.dataset.spotDescription || "No description available.";
      const icons = parseJsonData(card.dataset.spotIcons, []);
      const reviews = parseJsonData(card.dataset.spotReviews, []);

      activeSpotCard = card;
      spotDetailTitle.textContent = name;
      spotDetailImage.src = image;
      spotDetailImage.alt = name;
      spotDetailPrice.textContent = price;
      spotDetailRatingValue.textContent = String(rating);
      spotDetailRatingCount.textContent = ratingCount;
      spotDetailDescription.textContent = description;

      renderStars(spotDetailStars, rating);
      renderIcons(spotDetailIcons, icons);
      renderReviews(spotDetailReviews, reviews);

      writeReviewPanel.hidden = true;
      spotDetailReviews.hidden = false;
      writeReviewText.value = "";
      setRequestPublicButtonState(status, isOwner);
      
      if (shareSpotButton) {
        const normalizedStatus = String(status || "").trim().toLowerCase();
        shareSpotButton.hidden = !(isOwner && normalizedStatus === "private");
      }

      showPanel(spotDetailPanel, spotsPanel);
    });

    closeSpotDetailButton.addEventListener("click", () => {
      showPanel(spotsPanel, spotDetailPanel);
    });

    requestPublicButton.addEventListener("click", () => {
      if (requestPublicButton.hidden || requestPublicButton.disabled) {
        return;
      }

      requestPublicButton.textContent = "Public Request Pending";
      requestPublicButton.disabled = true;
      requestPublicButton.classList.add("spot-detail-request-public--pending");

      if (activeSpotCard) {
        activeSpotCard.dataset.spotStatus = "pending";
      }
    });

    spotDetailReviews.addEventListener("click", (event) => {
      const likeButton = event.target.closest(".review-card-like");

      if (!likeButton) {
        return;
      }

      const icon = likeButton.querySelector(".fa-thumbs-up");

      if (!icon) {
        return;
      }

      icon.classList.toggle("fa-regular");
      icon.classList.toggle("fa-solid");
    });
  }

  function setupWriteReviewPanel() {
    const writeReviewButton = document.getElementById("writeReviewButton");
    const spotDetailReviews = document.getElementById("spotDetailReviews");
    const writeReviewPanel = document.getElementById("writeReviewPanel");
    const cancelReviewButton = document.getElementById("cancelReviewButton");
    const postReviewButton = document.getElementById("postReviewButton");
    const writeReviewText = document.getElementById("writeReviewText");
    const writeReviewStarButtons = Array.from(
      document.querySelectorAll(".write-review-star-hitbox"),
    );
    const writeReviewStarIcons = Array.from(
      document.querySelectorAll(".write-review-star-icon"),
    );

    if (
      !writeReviewButton ||
      !spotDetailReviews ||
      !writeReviewPanel ||
      !cancelReviewButton ||
      !postReviewButton ||
      !writeReviewText
    ) {
      return;
    }

    let selectedReviewRating = 0;

    function renderWriteReviewStars(rating) {
      writeReviewStarIcons.forEach((icon, index) => {
        const starNumber = index + 1;

        icon.classList.remove(
          "fa-regular",
          "fa-solid",
          "fa-star",
          "fa-star-half-stroke",
        );

        if (rating >= starNumber) {
          icon.classList.add("fa-solid", "fa-star");
        } else if (rating >= starNumber - 0.5) {
          icon.classList.add("fa-solid", "fa-star-half-stroke");
        } else {
          icon.classList.add("fa-regular", "fa-star");
        }
      });
    }

    function openWriteReviewPanel() {
      spotDetailReviews.hidden = true;
      writeReviewPanel.hidden = false;
    }

    function closeWriteReviewPanel(clearForm = false) {
      writeReviewPanel.hidden = true;
      spotDetailReviews.hidden = false;

      if (clearForm) {
        selectedReviewRating = 0;
        writeReviewText.value = "";
        renderWriteReviewStars(selectedReviewRating);
      }
    }

    writeReviewButton.addEventListener("click", () => {
      openWriteReviewPanel();
    });

    cancelReviewButton.addEventListener("click", () => {
      closeWriteReviewPanel(false);
    });

    postReviewButton.addEventListener("click", () => {
      closeWriteReviewPanel(true);
    });

    writeReviewStarButtons.forEach((button) => {
      button.addEventListener("click", () => {
        selectedReviewRating = Number(button.dataset.rating);
        renderWriteReviewStars(selectedReviewRating);
      });
    });

    renderWriteReviewStars(selectedReviewRating);
  }

  function setupSharePopup() {
    const shareSpotButton = document.getElementById("shareSpotButton");
    const sharePopup = document.getElementById("sharePopup");
    const sharePopupBackdrop = document.getElementById("sharePopupBackdrop");
    const sharePopupSpotName = document.getElementById("sharePopupSpotName");
    const sharePopupEmailInput = document.getElementById(
      "sharePopupEmailInput",
    );
    const sharePopupSubmitButton = document.getElementById(
      "sharePopupSubmitButton",
    );
    const sharePopupCancelButton = document.getElementById(
      "sharePopupCancelButton",
    );
    const spotDetailTitle = document.getElementById("spotDetailTitle");

    if (
      !shareSpotButton ||
      !sharePopup ||
      !sharePopupBackdrop ||
      !sharePopupSpotName ||
      !sharePopupEmailInput ||
      !sharePopupSubmitButton ||
      !sharePopupCancelButton ||
      !spotDetailTitle
    ) {
      return;
    }

    let sharePopupCloseTimeout = null;

    function openSharePopup() {
      if (sharePopupCloseTimeout) {
        clearTimeout(sharePopupCloseTimeout);
        sharePopupCloseTimeout = null;
      }

      sharePopupSpotName.textContent = spotDetailTitle.textContent || "Spot";
      sharePopupEmailInput.value = "";

      sharePopup.hidden = false;
      sharePopupBackdrop.hidden = false;

      requestAnimationFrame(() => {
        sharePopup.classList.add("bookmark-popup--open");
        sharePopupBackdrop.classList.add("bookmark-popup-backdrop--open");
      });

      sharePopup.setAttribute("aria-hidden", "false");
    }

    function closeSharePopup() {
      if (!sharePopup.classList.contains("bookmark-popup--open")) {
        return;
      }

      sharePopup.classList.remove("bookmark-popup--open");
      sharePopupBackdrop.classList.remove("bookmark-popup-backdrop--open");
      sharePopup.setAttribute("aria-hidden", "true");

      sharePopupCloseTimeout = window.setTimeout(() => {
        sharePopup.hidden = true;
        sharePopupBackdrop.hidden = true;
        sharePopupCloseTimeout = null;
      }, 220);
    }

    shareSpotButton.addEventListener("click", () => {
      openSharePopup();
    });

    sharePopupBackdrop.addEventListener("click", () => {
      closeSharePopup();
    });

    sharePopup.addEventListener("click", (event) => {
      if (event.target === sharePopup) {
        closeSharePopup();
      }
    });

    sharePopupSubmitButton.addEventListener("click", () => {
      const email = sharePopupEmailInput.value.trim();

      if (!email) {
        sharePopupEmailInput.focus();
        return;
      }

      // Replace this with actual Flask endpoint
      console.log("Share spot with:", email);

      closeSharePopup();
    });

    sharePopupCancelButton.addEventListener("click", () => {
      sharePopupEmailInput.value = "";
      closeSharePopup();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSharePopup();
      }
    });

    window.closeSharePopup = closeSharePopup;
  }

  function initSpotDetailPanel() {
    setupSpotDetailPanel();
    setupWriteReviewPanel();
    setupSharePopup();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSpotDetailPanel);
  } else {
    initSpotDetailPanel();
  }
})();
