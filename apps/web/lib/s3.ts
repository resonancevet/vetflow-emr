import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";

let _s3: S3Client | null = null;

function resolveRegion(): string {
  const configured = process.env.S3_REGION?.trim();
  if (configured) return configured;
  // Cloudflare R2 accepts "auto"; defaulting here avoids signature mismatches
  // when the host env omits S3_REGION.
  if (process.env.S3_ENDPOINT?.includes("r2.cloudflarestorage.com")) {
    return "auto";
  }
  return "us-east-1";
}

function getS3(): S3Client {
  if (_s3) return _s3;

  const accessKeyId = process.env.S3_ACCESS_KEY?.trim() ?? "";
  const secretAccessKey = process.env.S3_SECRET_KEY?.trim() ?? "";
  const endpoint = process.env.S3_ENDPOINT?.trim();

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error(
      "File storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, and S3_BUCKET on the host.",
    );
  }

  _s3 = new S3Client({
    endpoint,
    region: resolveRegion(),
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // Required for MinIO / S3-compatible stores
  });
  return _s3;
}

function getBucket(): string {
  return process.env.S3_BUCKET?.trim() || "openpims";
}

export function isObjectStorageConfigured(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT?.trim() &&
      process.env.S3_ACCESS_KEY?.trim() &&
      process.env.S3_SECRET_KEY?.trim() &&
      process.env.S3_BUCKET?.trim(),
  );
}

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
        await getS3().send(new HeadBucketCommand({ Bucket: getBucket() }));
      } catch {
        try {
          await getS3().send(new CreateBucketCommand({ Bucket: getBucket() }));
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
  await getS3().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  // Build the URL from the endpoint so it works for both AWS S3 and MinIO
  const endpoint = process.env.S3_ENDPOINT ?? "https://s3.amazonaws.com";
  return `${endpoint}/${getBucket()}/${key}`;
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
    Bucket: getBucket(),
    Key: key,
  });

  return awsGetSignedUrl(getS3(), command, { expiresIn });
}

/**
 * Fetch an object from S3/MinIO. Used by the file proxy route so we never
 * expose the underlying storage endpoint to the browser (the presigned URL
 * would otherwise contain `localhost` in dev and break on phones/other LAN
 * devices).
 */
export async function getObject(key: string) {
  return getS3().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );
}

/**
 * Delete an object from S3/MinIO.
 *
 * @param key Object key to delete
 */
export async function deleteFile(key: string): Promise<void> {
  await getS3().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );
}

/** User-facing message for storage failures (safe to return in API JSON). */
export function storageErrorMessage(err: unknown): string {
  if (!isObjectStorageConfigured()) {
    return "File storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, and S3_BUCKET on the host.";
  }
  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message : String(err);
  if (
    name === "CredentialsProviderError" ||
    /access key|invalid.?access|signature|security token|forbidden|unauthorized/i.test(
      msg,
    )
  ) {
    return "File storage credentials were rejected. Check S3_ACCESS_KEY and S3_SECRET_KEY on the host.";
  }
  if (/NoSuchBucket/i.test(msg) || /bucket/i.test(name)) {
    return `File storage bucket not found (${getBucket()}). Check S3_BUCKET on the host.`;
  }
  return `Upload failed (${name || "Error"}: ${msg})`;
}
