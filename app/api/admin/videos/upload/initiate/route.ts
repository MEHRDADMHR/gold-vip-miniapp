import { randomUUID } from "node:crypto";
import { CreateMultipartUploadCommand, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getR2Config, R2_MAX_FILE_SIZE, R2_PART_SIZE } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") return NextResponse.json({ error: "فقط مدیر اصلی اجازه آپلود ویدیو دارد." }, { status: 403 });

  let body: { filename?: string; contentType?: string; size?: number };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const size = Number(body.size);
  const filename = typeof body.filename === "string" ? body.filename : "";
  const contentType = typeof body.contentType === "string" ? body.contentType : "application/octet-stream";
  if (!filename || !Number.isSafeInteger(size) || size < 1 || size > R2_MAX_FILE_SIZE) {
    return NextResponse.json({ error: "فایل باید معتبر و حداکثر ۵۰۰ مگابایت باشد." }, { status: 400 });
  }
  if (!contentType.startsWith("video/")) {
    return NextResponse.json({ error: "فقط فایل ویدیویی قابل آپلود است." }, { status: 400 });
  }

  try {
    const { client, bucket } = getR2Config();
    const safeName = filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-100) || "video";
    const key = `videos/${randomUUID()}-${safeName}`;
    const created = await client.send(new CreateMultipartUploadCommand({
      Bucket: bucket, Key: key, ContentType: contentType,
    }));
    if (!created.UploadId) throw new Error("Could not create multipart upload");

    const partCount = Math.ceil(size / R2_PART_SIZE);
    const parts: Array<{ partNumber: number; url: string }> = [];
    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const command = new UploadPartCommand({
        Bucket: bucket, Key: key, UploadId: created.UploadId, PartNumber: partNumber,
      });
      parts.push({ partNumber, url: await getSignedUrl(client, command, { expiresIn: 3600 }) });
    }

    return NextResponse.json({ key, uploadId: created.UploadId, partSize: R2_PART_SIZE, parts });
  } catch (error) {
    console.error("R2 multipart initiate failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "شروع آپلود ناموفق بود." }, { status: 502 });
  }
}
