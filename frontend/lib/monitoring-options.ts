type MonitoringOptions = Parameters<typeof import('@sentry/nextjs').init>[0];

// Sentry 11 broadens collection defaults. Keep the v10 privacy baseline explicit
// and identical for the browser, Node server and edge initialization paths.
export const monitoringDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
  },
  httpBodies: [],
  urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false },
  frameContextLines: 7,
} satisfies NonNullable<MonitoringOptions['dataCollection']>;
