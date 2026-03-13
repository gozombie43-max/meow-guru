function createMockQuestion(index) {
  return {
    id: index + 1,
    text: `Question ${index + 1}: What is the best answer for this mock test item?`,
    options: [
      `Option A for question ${index + 1}`,
      `Option B for question ${index + 1}`,
      `Option C for question ${index + 1}`,
      `Option D for question ${index + 1}`,
    ],
  };
}

export const QUESTIONS = Array.from({ length: 377 }, (_, index) => createMockQuestion(index));
