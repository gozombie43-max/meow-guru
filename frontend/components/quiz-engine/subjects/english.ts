import type { SubjectConfig } from "../types";

export const englishConfig: SubjectConfig = {
  subjectId: "english",
  subjectLabel: "English",
  cssClassName: "english-quiz",
  formulaModeLabel: "Vocabulary Practice",
  topicConcepts: {
    "synonyms-antonyms": ["Synonym Selection", "Antonym Selection", "Contextual Usage", "Degree of Meaning"],
    "homonyms-homophones": ["Same Sound Different Meaning", "Same Spelling Different Meaning", "Contextual Disambiguation"],
    "one-word-substitution": ["People & Professions", "Places & Institutions", "Actions & Behaviors", "Science & Nature Terms"],
    "idioms-phrases": ["Meaning Identification", "Correct Usage", "Fill in the Blank with Idiom", "Origin & Context"],
    "spelling-misspelled-words": ["Detect the Misspelled Word", "Correct the Spelling", "Commonly Confused Words"],
    "active-passive-voice": ["Simple Tense Conversions", "Modal Voice Change", "Interrogative & Negative", "Complex Sentences"],
    "direct-indirect-narration": ["Statements", "Questions", "Commands & Requests", "Exclamations", "Tense Backshift Rules"],
    "subject-verb-agreement": ["Collective Nouns", "Indefinite Pronouns", "Either/Neither", "Intervening Phrases", "Inversion"],
    tenses: ["Simple Tenses", "Continuous Tenses", "Perfect Tenses", "Perfect Continuous", "Mixed Tense Errors"],
    articles: ["A / An Usage", "The Usage", "Zero Article", "Articles with Proper Nouns"],
    prepositions: ["Place & Position", "Time Prepositions", "Direction & Movement", "Phrasal Prepositions", "Idiomatic Use"],
    conjunctions: ["Coordinating", "Subordinating", "Correlative Pairs", "Conjunctive Adverbs"],
    modifiers: ["Dangling Modifiers", "Misplaced Modifiers", "Squinting Modifiers", "Adjective vs Adverb"],
    pronouns: ["Pronoun-Antecedent Agreement", "Case of Pronouns", "Reflexive Pronouns", "Relative Pronouns"],
    "sentence-structure": ["Simple / Compound / Complex", "Clause Types", "Phrase Types", "Transformation of Sentences"],
    parallelism: ["Parallel Verbs", "Parallel Nouns & Phrases", "Correlative Parallelism", "List Parallelism"],
    "spot-the-error-error-detection": ["Grammar Errors", "Word Choice Errors", "Punctuation Errors", "Part-wise Error Spotting"],
    "sentence-correction-improvement": ["Replace Underlined Part", "Rewrite Correctly", "Choose Best Alternative", "No Improvement Cases"],
    "fill-in-the-blanks": ["Grammar Based", "Vocabulary Based", "Double Blanks", "Contextual Inference"],
    "cloze-test": ["Vocabulary Cloze", "Grammar Cloze", "Contextual Cloze", "Discourse Cloze"],
    "reading-comprehension": ["Main Idea / Title", "Inference Questions", "Vocabulary in Context", "Author's Tone & Purpose", "Factual Detail", "Editorial / Current Affairs Passage", "Story-Based Passage"],
    "para-jumbles": ["Identify Opening Sentence", "Logical Sequence", "Connector Words", "Pronoun Reference Links"],
    "para-sentence-completion": ["Choose Best Concluding Sentence", "Opening Sentence Completion", "Contextual Fit", "Tone Matching"],
  },
  classificationCategories: [
    { id: "vocab", label: "Vocabulary", icon: "ABC", accent: "#fb923c", bg: "rgba(251, 146, 60, 0.1)", border: "rgba(251, 146, 60, 0.28)" },
    { id: "grammar", label: "Grammar", icon: "Grm", accent: "#2dd4a0", bg: "rgba(45, 212, 160, 0.1)", border: "rgba(45, 212, 160, 0.28)" },
    { id: "sentence", label: "Sentence Skills", icon: "Sen", accent: "#d946ef", bg: "rgba(217, 70, 239, 0.1)", border: "rgba(217, 70, 239, 0.28)" },
    { id: "passage", label: "Passage Based", icon: "Psg", accent: "#38bdf8", bg: "rgba(56, 189, 248, 0.1)", border: "rgba(56, 189, 248, 0.28)" },
    { id: "other", label: "General", icon: "...", accent: "#a78bfa", bg: "rgba(167, 139, 250, 0.1)", border: "rgba(167, 139, 250, 0.28)" },
  ],
  getClassificationCategoryId(concept: string): string {
    const normalized = concept.toLowerCase();
    if (normalized.includes("synonym") || normalized.includes("antonym") || normalized.includes("word") || normalized.includes("idiom") || normalized.includes("spelling") || normalized.includes("vocabulary")) return "vocab";
    if (normalized.includes("tense") || normalized.includes("voice") || normalized.includes("narration") || normalized.includes("verb") || normalized.includes("article") || normalized.includes("preposition") || normalized.includes("conjunction") || normalized.includes("pronoun") || normalized.includes("grammar")) return "grammar";
    if (normalized.includes("sentence") || normalized.includes("error") || normalized.includes("blank") || normalized.includes("modifier") || normalized.includes("parallelism")) return "sentence";
    if (normalized.includes("cloze") || normalized.includes("reading") || normalized.includes("passage") || normalized.includes("jumble") || normalized.includes("completion")) return "passage";
    return "other";
  },
};
