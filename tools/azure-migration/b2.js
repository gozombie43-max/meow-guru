import { S3Client } from '@aws-sdk/client-s3';

const {
  B2_ENDPOINT,
  B2_REGION,
  B2_ACCESS_KEY_ID,
  B2_SECRET_ACCESS_KEY,
  B2_BUCKET,
} = process.env;

if (
  !B2_ENDPOINT ||
  !B2_REGION ||
  !B2_ACCESS_KEY_ID ||
  !B2_SECRET_ACCESS_KEY ||
  !B2_BUCKET
) {
  throw new Error(
    'Backblaze B2 environment configuration is incomplete'
  );
}

export const b2Client = new S3Client({
  endpoint: B2_ENDPOINT,
  region: B2_REGION,
  credentials: {
    accessKeyId: B2_ACCESS_KEY_ID,
    secretAccessKey: B2_SECRET_ACCESS_KEY,
  },
});

export { B2_BUCKET };