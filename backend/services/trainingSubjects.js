export const normalizeTrainingSubject = subject => {
  const key = String(subject || 'Unclassified').trim().toLowerCase().replace(/[\s_-]+/g, '-');
  return key === 'logical-reasoning' ? 'reasoning' : key;
};
