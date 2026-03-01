import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
	region: "auto",
	endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID!,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
	},
});

const bucket = process.env.R2_BUCKET_NAME!;

export async function generateUploadUrl(fileKey: string, mimeType: string) {
	return getSignedUrl(
		s3,
		new PutObjectCommand({
			Bucket: bucket,
			Key: fileKey,
			ContentType: mimeType,
		}),
		{ expiresIn: 900 },
	);
}

export async function generateDownloadUrl(fileKey: string) {
	return getSignedUrl(
		s3,
		new GetObjectCommand({
			Bucket: bucket,
			Key: fileKey,
		}),
		{ expiresIn: 3600 },
	);
}

export async function deleteObject(fileKey: string) {
	await s3.send(
		new DeleteObjectCommand({
			Bucket: bucket,
			Key: fileKey,
		}),
	);
}
