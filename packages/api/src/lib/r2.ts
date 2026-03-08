import { AwsClient } from "aws4fetch";

const r2 = new AwsClient({
	accessKeyId: process.env.R2_ACCESS_KEY_ID!,
	secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
});

const bucket = process.env.R2_BUCKET_NAME!;
const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export async function generateUploadUrl(fileKey: string, mimeType: string) {
	const url = new URL(`/${bucket}/${fileKey}`, endpoint);
	url.searchParams.set("X-Amz-Expires", "900");

	const signed = await r2.sign(
		new Request(url, {
			method: "PUT",
			headers: { "Content-Type": mimeType },
		}),
		{ aws: { signQuery: true } },
	);

	return signed.url;
}

export async function generateDownloadUrl(fileKey: string) {
	const url = new URL(`/${bucket}/${fileKey}`, endpoint);
	url.searchParams.set("X-Amz-Expires", "3600");

	const signed = await r2.sign(new Request(url), {
		aws: { signQuery: true },
	});

	return signed.url;
}

export async function deleteObject(fileKey: string) {
	const url = new URL(`/${bucket}/${fileKey}`, endpoint);

	await r2.fetch(url.toString(), { method: "DELETE" });
}
