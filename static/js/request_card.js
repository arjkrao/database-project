(function () {
    function setupRequestCardActions() {
        document.querySelectorAll(".request-card").forEach((card) => {
            const approveButton = card.querySelector(".request-approve");
            const rejectButton = card.querySelector(".request-reject");

            if (!approveButton || !rejectButton) {
                return;
            }

            if (card.dataset.requestCardBound === "true") {
                return;
            }

            card.dataset.requestCardBound = "true";

            approveButton.addEventListener("click", () => {
                card.classList.add("request-card--approved");
                card.classList.remove("request-card--rejected");
            });

            rejectButton.addEventListener("click", () => {
                card.classList.add("request-card--rejected");
                card.classList.remove("request-card--approved");
            });
        });
    }

    function initRequestCards() {
        setupRequestCardActions();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initRequestCards);
    } else {
        initRequestCards();
    }
})();