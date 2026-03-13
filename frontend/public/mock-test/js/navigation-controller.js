function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

export class NavigationController {
  constructor({ questions, elements }) {
    this.questions = questions;
    this.elements = elements;
    this.currentQuestionIndex = 0;
    this.answers = new Array(questions.length).fill(null);
    this.touchStartX = null;
    this.touchStartY = null;
  }

  init() {
    this.renderPalette();
    this.bindEvents();
    this.showQuestion(0);
  }

  bindEvents() {
    const {
      previousBtn,
      nextBtn,
      jumpForm,
      jumpInput,
      questionPalette,
      questionCard,
      optionsList,
    } = this.elements;

    previousBtn.addEventListener("click", () => {
      this.showQuestion(this.currentQuestionIndex - 1);
    });

    nextBtn.addEventListener("click", () => {
      this.showQuestion(this.currentQuestionIndex + 1);
    });

    jumpForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = Number.parseInt(jumpInput.value, 10);
      if (Number.isNaN(value)) {
        this.setJumpMessage("Enter a valid number.");
        return;
      }
      if (value < 1 || value > this.questions.length) {
        this.setJumpMessage(`Use a value between 1 and ${this.questions.length}.`);
        return;
      }
      this.setJumpMessage("");
      this.showQuestion(value - 1);
    });

    questionPalette.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const btn = target.closest("button[data-index]");
      if (!btn) {
        return;
      }
      const nextIndex = Number.parseInt(btn.dataset.index || "0", 10);
      this.showQuestion(nextIndex);
    });

    optionsList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const btn = target.closest("button[data-option-index]");
      if (!btn) {
        return;
      }
      const optionIndex = Number.parseInt(btn.dataset.optionIndex || "0", 10);
      this.selectOption(optionIndex);
    });

    document.addEventListener("keydown", (event) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA") {
        return;
      }

      if (event.key === "ArrowLeft") {
        this.showQuestion(this.currentQuestionIndex - 1);
        return;
      }
      if (event.key === "ArrowRight") {
        this.showQuestion(this.currentQuestionIndex + 1);
        return;
      }

      const numeric = Number.parseInt(event.key, 10);
      if (numeric >= 1 && numeric <= 4) {
        this.selectOption(numeric - 1);
      }
    });

    questionCard.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
    }, { passive: true });

    questionCard.addEventListener("touchend", (event) => {
      if (this.touchStartX === null || this.touchStartY === null) {
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;

      this.touchStartX = null;
      this.touchStartY = null;

      if (Math.abs(deltaX) < 45 || Math.abs(deltaY) > 80) {
        return;
      }

      if (deltaX > 0) {
        this.showQuestion(this.currentQuestionIndex - 1);
      } else {
        this.showQuestion(this.currentQuestionIndex + 1);
      }
    }, { passive: true });
  }

  showQuestion(index) {
    const safeIndex = clamp(index, 0, this.questions.length - 1);
    this.currentQuestionIndex = safeIndex;

    this.renderActiveQuestion();
    this.updatePagerButtons();
    this.updatePaletteState();
    this.updateJumpInput();
    this.autoScrollPalette();
  }

  renderPalette() {
    const fragment = document.createDocumentFragment();

    this.questions.forEach((_, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "palette-btn";
      btn.dataset.index = String(index);
      btn.setAttribute("aria-label", `Question ${index + 1}`);
      btn.textContent = String(index + 1);
      fragment.appendChild(btn);
    });

    this.elements.questionPalette.appendChild(fragment);
  }

  renderActiveQuestion() {
    const question = this.questions[this.currentQuestionIndex];
    const selectedOption = this.answers[this.currentQuestionIndex];

    this.elements.questionMeta.textContent = `Question ${this.currentQuestionIndex + 1}`;
    this.elements.questionText.textContent = question.text;
    this.elements.questionCounter.textContent = `Question ${this.currentQuestionIndex + 1} / ${this.questions.length}`;

    const optionsMarkup = question.options
      .map((optionText, optionIndex) => {
        const selectedClass = selectedOption === optionIndex ? " selected" : "";
        return `
          <button
            type="button"
            class="option-btn${selectedClass}"
            data-option-index="${optionIndex}"
            role="radio"
            aria-checked="${selectedOption === optionIndex}"
          >
            ${optionIndex + 1}. ${optionText}
          </button>
        `;
      })
      .join("");

    this.elements.optionsList.innerHTML = optionsMarkup;
  }

  selectOption(optionIndex) {
    this.answers[this.currentQuestionIndex] = optionIndex;
    this.renderActiveQuestion();
    this.updatePaletteState();
  }

  updatePagerButtons() {
    this.elements.previousBtn.disabled = this.currentQuestionIndex === 0;
    this.elements.nextBtn.disabled = this.currentQuestionIndex === this.questions.length - 1;
  }

  updatePaletteState() {
    const buttons = this.elements.questionPalette.querySelectorAll("button[data-index]");

    buttons.forEach((button, index) => {
      button.classList.toggle("active", index === this.currentQuestionIndex);
      button.classList.toggle("answered", this.answers[index] !== null);
      button.setAttribute("aria-selected", String(index === this.currentQuestionIndex));
    });
  }

  autoScrollPalette() {
    const selector = `button[data-index="${this.currentQuestionIndex}"]`;
    const activeButton = this.elements.questionPalette.querySelector(selector);
    if (!activeButton) {
      return;
    }

    activeButton.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }

  updateJumpInput() {
    this.elements.jumpInput.value = String(this.currentQuestionIndex + 1);
  }

  setJumpMessage(message) {
    this.elements.jumpMessage.textContent = message;
  }
}
