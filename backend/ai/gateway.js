import { chatJSON } from './azureClient.js';
import { questionDraftsSchema, questionTagsSchema } from '@meow/contracts/ai';
import { geometryDiagramSchema } from '@meow/contracts/geometry';

// Use cases own schema and model policy; azureClient owns transport, timeout and gate.
export const generateQuestionDrafts = (prompt, system) => chatJSON(prompt, 'o4-mini', system, questionDraftsSchema);
export const classifyQuestion = (prompt, system) => chatJSON(prompt, 'o4-mini', system, questionTagsSchema);
export const generateDiagram = (question, system) => chatJSON(question, process.env.DIAGRAM_MODEL || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5-5', system, geometryDiagramSchema, 1000);
