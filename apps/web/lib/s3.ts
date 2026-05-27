import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "",
  },
  forcePathStyle: true, // Required for MinIO / S3-compatible stores
});

const bucket = process.env.S3_BUCKET ?? "openpims";

// In dev, an empty MinIO volume won't have the bucket yet. Create it on first
// upload so devs don't hit a confusing "NoSuchBucket" error after a volume
// reset. In production we leave bucket creation to infra so we don't silently
// mask misconfigured credentials.
let bucketReadyPromise: Promise<void> | null = null;

async function ensureBucket(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  if (!bucketReadyPromise) {
    bucketReadyPromise = (async () => {
      try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch {
        try {
          await s3.send(new CreateBucketCommand({ Bucket: bucket }));
        } catch (err: unknown) {
          const code =
            (err as { name?: string; Code?: string }).name ??
            (err as { Code?: string }).Code;
          if (
            code !== "BucketAlreadyOwnedByYou" &&
            code !== "BucketAlreadyExists"
          ) {
            bucketReadyPromise = null;
            throw err;
          }
        }
      }
    })();
  }
  return bucketReadyPromise;
}

/**
 * Upload a file to S3/MinIO.
 *
 * @param key   Object key, e.g. `{practiceId}/{category}/{uuid}-{filename}`
 * @param body  File contents as a Buffer
 * @param contentType  MIME type of the file
 * @returns The public URL of the uploaded object
 */
export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await ensureBucket();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  // Build the URL from the endpoint so it works for both AWS S3 and MinIO
  const endpoint = process.env.S3_ENDPOINT ?? "https://s3.amazonaws.com";
  return `${endpoint}/${bucket}/${key}`;
}

/**
 * Generate a pre-signed URL for reading a private object.
 *
 * @param key       Object key in S3
 * @param expiresIn Seconds until the URL expires (default 1 hour)
 * @returns A pre-signed GET URL
 */
export async function getSignedUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return awsGetSignedUrl(s3, command, { expiresIn });
}

/**
 * Delete an object from S3/MinIO.
 *
 * @param key Object key to delete
 */
export async function deleteFile(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}
