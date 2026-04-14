import { BlobServiceClient } from "@azure/storage-blob";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

if (!connectionString) {
  throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set");
}

export const blobServiceClient = BlobServiceClient.fromConnectionString(
  connectionString
);

export const questionsContainer = blobServiceClient.getContainerClient(
  process.env.AZURE_STORAGE_CONTAINER_QUESTIONS
);

export const solutionsContainer = blobServiceClient.getContainerClient(
  process.env.AZURE_STORAGE_CONTAINER_SOLUTIONS
);