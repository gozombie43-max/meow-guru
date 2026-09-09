// Only question content needed to take an exam may cross the active-attempt boundary.
// Keep full persisted content for completed-test review.
const QUESTION_FIELDS = [
  'id', 'text', 'question', 'questionHindi', 'questionType', 'options',
  'image', 'questionImage', 'optionImages', 'optionAImage', 'optionBImage',
  'optionCImage', 'optionDImage', 'passage', 'sectionKey', 'subject', 'topic',
];

export function activePaper(paper) {
  return {
    ...paper,
    sections: (paper?.sections || []).map(section => ({
      ...section,
      questions: (section.questions || []).map(question => {
        const safe = Object.fromEntries(QUESTION_FIELDS
          .filter(key => Object.hasOwn(question, key))
          .map(key => [key, question[key]]));
        if (Array.isArray(safe.options)) {
          safe.options = safe.options.map(option => typeof option === 'object' && option !== null
            ? Object.fromEntries(['id', 'text', 'image'].filter(key => Object.hasOwn(option, key)).map(key => [key, option[key]]))
            : option);
        }
        return safe;
      }),
    })),
  };
}
