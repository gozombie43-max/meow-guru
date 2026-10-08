import { AsyncLocalStorage } from 'node:async_hooks';
import { mongoCommands, mongoCommandLatency } from './metrics.js';

export const mongoRequestContext = new AsyncLocalStorage();
export const AUTH_VALIDATION_COMMENT = 'meow.auth.validation';
const collections = new Set(['authSessions', 'users', 'questions', 'questionMetadata', 'conceptGroupMetadata', 'mockSlots', 'mockAttempts', 'userQuestionProgress', 'userTopicProgress', 'userQuizHistory', 'userAnalytics', 'aiConversations', 'aiMessages', 'trainingSessions', 'trainingReviewState', 'trainingQuestionExposure', 'trainingSkillState', 'trainingLearnerStateMeta', 'runtimeCacheRevisions', 'idempotencyRecords']);
const commands = new Set(['find', 'aggregate', 'count', 'distinct', 'insert', 'update', 'delete', 'findAndModify', 'getMore', 'commitTransaction', 'abortTransaction']);

export function attachMongoOperationMetrics(client) {
  const pending = new Map();
  const started = event => {
    if (!commands.has(event.commandName)) return;
    const rawCollection = event.commandName === 'getMore' ? event.command.collection : event.command[event.commandName];
    const labels = {
      collection: collections.has(rawCollection) ? rawCollection : 'other',
      command: event.commandName,
      purpose: event.command.comment === AUTH_VALIDATION_COMMENT ? 'authorization' : 'application',
    };
    const request = mongoRequestContext.getStore();
    if (request) {
      request.total++;
      const key = `${labels.purpose}:${labels.collection}:${labels.command}`;
      request.operations[key] = (request.operations[key] || 0) + 1;
    }
    // No command bodies, IDs, filters or credentials are retained.
    pending.set(event.requestId, { labels });
  };
  const finished = (event, outcome) => {
    const operation = pending.get(event.requestId);
    if (!operation) return;
    pending.delete(event.requestId);
    const labels = { ...operation.labels, outcome };
    mongoCommands.inc(labels);
    // Successful getMore can be an idle change-stream wait, not query latency.
    if (event.commandName !== 'getMore' || outcome === 'error') mongoCommandLatency.observe(labels, event.duration / 1000);
  };
  client.on('commandStarted', started);
  client.on('commandSucceeded', event => finished(event, 'success'));
  client.on('commandFailed', event => finished(event, 'error'));
}
