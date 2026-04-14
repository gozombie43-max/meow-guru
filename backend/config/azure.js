import { BlobServiceClient } from "@azure/storage-blob";

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

export const questionsContainer = blobServiceClient.getContainerClient(
  process.env.AZURE_STORAGE_CONTAINER_QUESTIONS
);

export const solutionsContainer = blobServiceClient.getContainerClient(
  process.env.AZURE_STORAGE_CONTAINER_SOLUTIONS
);