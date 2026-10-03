(function () {
  function ensureModal() {
    let modal = document.getElementById("article-message-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "article-message-modal";
    modal.className = "article-message-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="article-message-dialog" role="dialog" aria-modal="true" aria-labelledby="article-message-title">
        <button class="article-message-x" type="button" aria-label="Dismiss message">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
        <p id="article-message-kicker" class="articles-kicker"></p>
        <h2 id="article-message-title"></h2>
        <p id="article-message-body"></p>
        <div class="article-message-actions"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest(".article-message-x")) closeModal();
    });
    document.addEventListener("keydown", (event) => {
      if (!modal.hidden && event.key === "Escape") closeModal();
    });
    return modal;
  }

  function closeModal(value = false) {
    const modal = document.getElementById("article-message-modal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("article-modal-open");
    if (modal._resolve) {
      modal._resolve(value);
      modal._resolve = null;
    }
  }

  function setButtonBusy(button, isBusy) {
    const spinner = button.querySelector(".article-tiny-spinner");
    if (spinner) spinner.hidden = !isBusy;
    button.classList.toggle("is-loading", isBusy);
    button.disabled = isBusy;
  }

  function ensureButtonProgress(button) {
    let progress = button.querySelector(".article-button-progress");
    if (progress) return progress;

    progress = document.createElement("span");
    progress.className = "article-button-progress";
    progress.hidden = true;
    progress.setAttribute("aria-hidden", "true");
    progress.innerHTML = `
      <svg viewBox="0 0 24 24">
        <circle class="article-button-progress-bg" cx="12" cy="12" r="9"></circle>
        <circle class="article-button-progress-ring" cx="12" cy="12" r="9"></circle>
      </svg>
      <span class="article-button-progress-label">0%</span>
    `;
    button.appendChild(progress);
    return progress;
  }

  function setButtonProgress(button, percent) {
    if (!button) return;

    const progress = ensureButtonProgress(button);
    const ring = progress.querySelector(".article-button-progress-ring");
    const label = progress.querySelector(".article-button-progress-label");
    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    const circumference = 2 * Math.PI * 9;
    const offset = circumference - (value / 100) * circumference;

    progress.hidden = false;
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(offset);
    label.textContent = `${Math.round(value)}%`;
  }

  function resetButtonProgress(button) {
    const progress = button && button.querySelector(".article-button-progress");
    if (!progress) return;
    progress.hidden = true;
    setButtonProgress(button, 0);
    progress.hidden = true;
  }

  function showModal({ title, message, kicker = "Article message", confirmText = "OK", cancelText = "", danger = false, onConfirm = null }) {
    const modal = ensureModal();
    modal.querySelector("#article-message-kicker").textContent = kicker;
    modal.querySelector("#article-message-title").textContent = title || "Message";
    modal.querySelector("#article-message-body").textContent = message || "";

    const actions = modal.querySelector(".article-message-actions");
    actions.innerHTML = "";

    if (cancelText) {
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "button-secondary";
      cancelButton.textContent = cancelText;
      cancelButton.addEventListener("click", () => closeModal(false));
      actions.appendChild(cancelButton);
    }

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = danger ? "article-danger-action" : "";
    confirmButton.innerHTML = `
      <span>${confirmText}</span>
      <span class="article-tiny-spinner article-button-spinner" hidden aria-hidden="true"></span>
    `;
    confirmButton.addEventListener("click", async () => {
      if (!onConfirm) {
        closeModal(true);
        return;
      }

      setButtonBusy(confirmButton, true);
      try {
        await onConfirm();
        closeModal(true);
      } catch (error) {
        setButtonBusy(confirmButton, false);
        closeModal(false);
        showModal({
          title: "Action failed",
          message: error.message || "Something went wrong.",
          kicker: "Article message"
        });
      }
    });
    actions.appendChild(confirmButton);

    modal.hidden = false;
    document.body.classList.add("article-modal-open");
    confirmButton.focus();

    return new Promise((resolve) => {
      modal._resolve = resolve;
    });
  }

  window.RMArticleUI = {
    alert(message, options = {}) {
      return showModal({
        title: options.title || "Message",
        message,
        kicker: options.kicker || "Article message",
        confirmText: options.confirmText || "OK"
      });
    },
    confirm(message, options = {}) {
      return showModal({
        title: options.title || "Please confirm",
        message,
        kicker: options.kicker || "Article message",
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel",
        danger: Boolean(options.danger),
        onConfirm: options.onConfirm || null
      });
    },
    close: closeModal,
    setButtonProgress,
    resetButtonProgress
  };
})();
