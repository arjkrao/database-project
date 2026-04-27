(function () {
  let currentActiveSpotId = null;

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

  let activeSpotCard = null;
  let activeSpotReviews = [];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };

      return entities[character];
    });
  }

  function getReviewTimestamp(review) {
    return String(review.review_timestamp || review.id || "");
  }

  function getActiveSpotId() {
    return activeSpotCard?.dataset.spotId || "";
  }

  function getActiveSpotReviews() {
    if (!activeSpotCard) {
      return activeSpotReviews;
    }

    return parseJsonData(activeSpotCard.dataset.spotReviews, activeSpotReviews);
  }

  function refreshHomeSpotsFromServer() {
    if (typeof window.reloadSpotsList === "function") {
      window.reloadSpotsList({ force: true });
    }
  }

  function updateActiveSpotReviews(reviews) {
    activeSpotReviews = reviews;

    if (activeSpotCard) {
      activeSpotCard.dataset.spotReviews = JSON.stringify(reviews);
    }

    const spotDetailReviews = document.getElementById("spotDetailReviews");
    if (spotDetailReviews) {
      renderReviews(spotDetailReviews, reviews);
    }
  }

  function updateSpotRatingDisplay(spotStats) {
    if (!spotStats) {
      return;
    }

    const rating = Number(spotStats.rating || 0);
    const ratingCount = Number(spotStats.rating_count || 0);
    const displayRating = Number.isFinite(rating) ? rating.toFixed(1) : "0.0";
    const displayCount = Number.isFinite(ratingCount) ? ratingCount : 0;

    const spotDetailRatingValue = document.getElementById(
      "spotDetailRatingValue",
    );
    const spotDetailRatingCount = document.getElementById(
      "spotDetailRatingCount",
    );
    const spotDetailStars = document.getElementById("spotDetailStars");

    if (spotDetailRatingValue) {
      spotDetailRatingValue.textContent = displayRating;
    }

    if (spotDetailRatingCount) {
      spotDetailRatingCount.textContent = `(${displayCount})`;
    }

    if (spotDetailStars) {
      renderStars(spotDetailStars, rating);
    }

    if (!activeSpotCard) {
      return;
    }

    activeSpotCard.dataset.spotRating = displayRating;
    activeSpotCard.dataset.spotRatingCount = `(${displayCount})`;

    const ratingSummary = activeSpotCard.querySelector(".spot-rating-summary");
    if (!ratingSummary) {
      return;
    }

    const ratingTextElements = ratingSummary.querySelectorAll(".small.text-gray");
    const ratingValue = ratingTextElements[0];
    const ratingCounter = ratingTextElements[ratingTextElements.length - 1];
    const ratingStars = ratingSummary.querySelector(".spot-stars");

    if (ratingValue) {
      ratingValue.textContent = displayRating;
    }

    if (ratingCounter) {
      ratingCounter.textContent = `(${displayCount})`;
    }

    if (ratingStars) {
      renderStars(ratingStars, rating);
    }
  }

  async function addActiveReview(rating, reviewText) {
    const locationId = getActiveSpotId();

    if (!locationId) {
      throw new Error("No active spot selected.");
    }

    const formData = new FormData();
    formData.append("location_id", locationId);
    formData.append("rating", String(rating));
    formData.append("review_text", reviewText);

    const response = await fetch("/profile/review/add", {
      method: "POST",
      body: formData,
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to add review.");
    }

    updateActiveSpotReviews([result.review, ...getActiveSpotReviews()]);
    updateSpotRatingDisplay(result.spot);
    refreshHomeSpotsFromServer();
  }

  async function deleteActiveReview(reviewCard) {
    const locationId = reviewCard?.dataset.locationId || getActiveSpotId();
    const reviewTimestamp = reviewCard?.dataset.reviewTimestamp || "";

    if (!locationId || !reviewTimestamp) {
      throw new Error("Review could not be identified.");
    }

    const formData = new FormData();
    formData.append("location_id", locationId);
    formData.append("review_timestamp", reviewTimestamp);

    const response = await fetch("/profile/review/delete", {
      method: "POST",
      body: formData,
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to delete review.");
    }

    updateActiveSpotReviews(
      getActiveSpotReviews().filter(
        (review) => getReviewTimestamp(review) !== reviewTimestamp,
      ),
    );
    updateSpotRatingDisplay(result.spot);
    refreshHomeSpotsFromServer();
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
    const reviewTimestamp = getReviewTimestamp(review);
    const deleteButtonMarkup = review.can_delete
      ? `
            <button class="review-card-delete" type="button" aria-label="Delete review">
              <i class="fa-solid fa-trash"></i>
            </button>
          `
      : "";

    return `
      <article
        class="review-card spot-detail-review-card"
        data-review-id="${escapeHtml(reviewTimestamp)}"
        data-location-id="${escapeHtml(review.location_id ?? "")}"
        data-review-timestamp="${escapeHtml(reviewTimestamp)}"
      >
        <div class="review-card-top">
          <div class="review-card-meta">
            <i class="fa-solid fa-circle-user icon-review-profile"></i>
            <div class="heading-4 text-black">${escapeHtml(review.author)}</div>
          </div>

          <div class="review-card-interactions">
            <div class="spot-stars">
              ${createReviewStarsMarkup(Number(review.rating || 0))}
            </div>

            ${deleteButtonMarkup}
          </div>
        </div>

        <p class="text text-black">${escapeHtml(review.body)}</p>

        <div class="review-card-bottom">
          <div class="small text-gray">${escapeHtml(review.date)}</div>
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

      const deleteButton = event.target.closest(".spot-delete");
      if (deleteButton) {
        if (!confirm("Are you sure you want to delete this location? This action cannot be undone.")) {
          return;
        }

        const cardDeleteId = card.dataset.spotId;
        const formData = new FormData();
        formData.append("location_id", cardDeleteId);

        fetch("/home/delete_spot", { method: "POST", body: formData })
          .then(res => res.json())
          .then(data => {
            if (data.status === "success") {
              card.remove();
              if (currentActiveSpotId === cardDeleteId) {
                const spotDetailPanel = document.getElementById("spotDetailPanel");
                const spotsPanel = document.getElementById("spotsPanel");
                spotDetailPanel.hidden = true;
                spotsPanel.classList.remove("left-panel-hidden");
                if (activeSpotCard) {
                  activeSpotCard.classList.remove("right-panel-active");
                  activeSpotCard = null;
                  currentActiveSpotId = null;
                }
              }
            } else {
              alert(data.message || "Failed to delete location.");
            }
          })
          .catch(err => {
            console.error("Delete spot error:", err);
            alert("An error occurred trying to delete this location.");
          });
        return;
      }

      if (
        event.target.closest(".spot-bookmark") ||
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

      currentActiveSpotId = card.dataset.spotId;
      activeSpotCard = card;
      activeSpotReviews = reviews;
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

      const originalText = requestPublicButton.textContent;
      requestPublicButton.textContent = "Requesting...";
      requestPublicButton.disabled = true;

      const formData = new FormData();
      formData.append("location_id", currentActiveSpotId);

      fetch('/home/request_public', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
          if (data.status === "success") {
            requestPublicButton.textContent = "Public Request Pending";
            requestPublicButton.classList.add("spot-detail-request-public--pending");

            if (activeSpotCard) {
              activeSpotCard.dataset.spotStatus = "pending";
            }
          } else {
            console.error("Error from backend:", data.message);
            requestPublicButton.textContent = originalText;
            requestPublicButton.disabled = false;
          }
        })
        .catch(err => {
          console.error("Fetch error:", err);
          requestPublicButton.textContent = originalText;
          requestPublicButton.disabled = false;
        });
    });

    spotDetailReviews.addEventListener("click", async (event) => {
      const deleteButton = event.target.closest(".review-card-delete");
      if (deleteButton) {
        const reviewCard = deleteButton.closest(".review-card");

        try {
          deleteButton.disabled = true;
          await deleteActiveReview(reviewCard);
        } catch (error) {
          console.error(error);
          deleteButton.disabled = false;
        }

        return;
      }

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

    postReviewButton.addEventListener("click", async () => {
      const reviewText = writeReviewText.value.trim();

      if (!selectedReviewRating) {
        return;
      }

      if (!reviewText) {
        writeReviewText.focus();
        return;
      }

      try {
        postReviewButton.disabled = true;
        await addActiveReview(selectedReviewRating, reviewText);
        closeWriteReviewPanel(true);
      } catch (error) {
        console.error(error);
      } finally {
        postReviewButton.disabled = false;
      }
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
    const sharePopupUnshareButton = document.getElementById(
      "sharePopupUnshareButton",
    );
    const sharePopupStatusText = document.getElementById(
      "sharePopupStatusText",
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
      if (sharePopupStatusText) {
        sharePopupStatusText.textContent = "";
        sharePopupStatusText.className = "small text-black";
      }

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

      const formData = new FormData();
      formData.append("email", email);
      formData.append("location_id", currentActiveSpotId);

      fetch('/home/share_spot', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
          if (sharePopupStatusText) {
            sharePopupStatusText.textContent = data.message;
            sharePopupStatusText.className = data.status === "success" ? "small text-success" : "small text-error";
          }
        })
        .catch(err => console.error("Error sharing spot:", err));
    });

    if (sharePopupUnshareButton) {
      sharePopupUnshareButton.addEventListener("click", () => {
        const email = sharePopupEmailInput.value.trim();

        if (!email) {
          sharePopupEmailInput.focus();
          return;
        }

        const formData = new FormData();
        formData.append("email", email);
        formData.append("location_id", currentActiveSpotId);

        fetch('/home/unshare_spot', { method: 'POST', body: formData })
          .then(res => res.json())
          .then(data => {
            if (sharePopupStatusText) {
              sharePopupStatusText.textContent = data.message;
              sharePopupStatusText.className = data.status === "success" ? "small text-success" : "small text-error";
            }
          })
          .catch(err => console.error("Error unsharing spot:", err));
      });
    }

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
