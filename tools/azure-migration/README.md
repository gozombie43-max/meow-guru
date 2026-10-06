# Azure migration tools

Cosmos DB and Azure Blob SDKs belong to this operator-only workspace. They are not dependencies of the Express API. Azure OpenAI, Speech and Translator remain active backend providers; Firebase remains active on both sides.

Install this workspace explicitly: `npm ci --workspace @meow/azure-migration --include-workspace-root=false`. Run a reviewed tool with `node scripts/<name>.js` from this directory, supplying its environment through the shell or a local ignored `.env`. The scripts retain their original behavior and may write data. Moving them does not execute a migration or establish migration completion.

The backend production install selects only `backend` and `@meow/contracts`, and the release artifact excludes this directory.
