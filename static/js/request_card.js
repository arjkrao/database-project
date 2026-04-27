(function () {
  function setupRequestCards() {
    const requestGrid = document.querySelector(".request-grid");

    if (!requestGrid) return;

    async function updateRequestStatus(card, url) {
      const locationId = card.dataset.requestId;

      const formData = new FormData();
      formData.append("location_id", locationId);

      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to update request");
      }

      card.remove();

      if (requestGrid.children.length === 0) {
        requestGrid.innerHTML = `
          <div class="heading-3 text-white">
            No requested spots.
          </div>
        `;
      }
    }

    requestGrid.addEventListener("click", async (event) => {
      const approveButton = event.target.closest(".request-approve");
      const rejectButton = event.target.closest(".request-reject");

      if (!approveButton && !rejectButton) return;

      const card = event.target.closest(".request-card");
      if (!card) return;

      try {
        if (approveButton) {
          await updateRequestStatus(card, "/home/admin/approve_spot");
          return;
        }

        if (rejectButton) {
          await updateRequestStatus(card, "/home/admin/reject_spot");
          return;
        }
      } catch (err) {
        console.error(err);
        alert("Failed to update requested spot.");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupRequestCards);
  } else {
    setupRequestCards();
  }
})();