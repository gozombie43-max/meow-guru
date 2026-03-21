import { QUESTIONS } from "./mock-data.js";
import { NavigationController } from "./navigation-controller.js";

const elements = {
  previousBtn: document.getElementById("previousBtn"),
  nextBtn: document.getElementById("nextBtn"),
  jumpForm: document.getElementById("jumpForm"),
  jumpInput: document.getElementById("jumpInput"),
  jumpMessage: document.getElementById("jumpMessage"),
  questionPalette: document.getElementById("questionPalette"),
  questionCard: document.getElementById("questionCard"),
  questionCounter: document.getElementById("questionCounter"),
  questionMeta: document.getElementById("questionMeta"),
  questionText: document.getElementById("questionText"),
  optionsList: document.getElementById("optionsList"),
};

const navigation = new NavigationController({
  questions: QUESTIONS,
  elements,
});

navigation.init();
