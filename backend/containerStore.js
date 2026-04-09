// containerStore.js
let questionsContainer = null;
let usersContainer = null;

export const setQuestionsContainer = (c) => { questionsContainer = c; };
export const setUsersContainer     = (c) => { usersContainer = c; };

export const getQuestionsContainer = () => {
  if (!questionsContainer) throw new Error("Questions container not initialized ❌");
  return questionsContainer;
};

export const getUsersContainer = () => {
  if (!usersContainer) throw new Error("Users container not initialized ❌");
  return usersContainer;
};