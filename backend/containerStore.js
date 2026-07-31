// containerStore.js
let questionsContainer = null;
let usersContainer = null;
let notesContainer = null;
let accessCodesContainer = null;

export const setQuestionsContainer = (c) => { questionsContainer = c; };
export const setUsersContainer     = (c) => { usersContainer = c; };
export const setNotesContainer     = (c) => { notesContainer = c; };

export const getQuestionsContainer = () => {
  if (!questionsContainer) throw new Error("Questions container not initialized ❌");
  return questionsContainer;
};

export const getUsersContainer = () => {
  if (!usersContainer) throw new Error("Users container not initialized ❌");
  return usersContainer;
};

export const getNotesContainer = () => {
  if (!notesContainer) throw new Error("Notes container not initialized ❌");
  return notesContainer;
};

export const setAccessCodesContainer = (c) => { accessCodesContainer = c; };
export const getAccessCodesContainer = () => {
  if (!accessCodesContainer) throw new Error("Access codes container not initialized ❌");
  return accessCodesContainer;
};