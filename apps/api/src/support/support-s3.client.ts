import { S3Client } from '@aws-sdk/client-s3';

const DEFAULT_REGION = 'ap-south-1';

/**
 * Shared S3 client for support inbound/attachments.
 * Credentials come from the AWS SDK default provider chain (EC2 IAM role).
 * Never accepts access keys.
 */
export function createSupportS3Client(region?: string): S3Client {
  return new S3Client({
    region: region?.trim() || process.env.AWS_REGION?.trim() || DEFAULT_REGION,
  });
}

export const SUPPORT_S3_CLIENT = Symbol('SUPPORT_S3_CLIENT');
