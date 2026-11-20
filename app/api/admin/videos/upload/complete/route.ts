import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getR2Config } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: {
    key?: string;
    uploadId?: string;
    parts?: Array<{ partNumber: number; etag: string }>;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  if (typeof body.key !== "string" || !/^videos\/[a-f0-9-]{36}-[a-zA-Z0-9._-]+$/.test(body.key) ||
      typeof body.uploadId !== "string" || !body.uploadId ||
      !Array.isArray(body.parts) || body.parts.length < 1 || body.parts.length > 64 ||
      body.parts.some(part => !Number.isInteger(part.partNumber) || part.partNumber < 1 || part.partNumber > 64 ||
        typeof part.etag !== "string" || part.etag.length > 200)) {
    return NextResponse.json({ error: "اطلاعات تکمیل آپلود معتبر نیست." }, { status: 400 });
  }

  try {
    const { client, bucket } = getR2Config();
    const parts = [...body.parts].sort((a, b) => a.partNumber - b.partNumber);
    if (parts.some((part, index) => part.partNumber !== index + 1)) {
      return NextResponse.json({ error: "ترتیب بخش‌های فایل معتبر نیست." }, { status: 400 });
    }
    await client.send(new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: body.key,
      UploadId: body.uploadId,
      MultipartUpload: { Parts: parts.map(part => ({ PartNumber: part.partNumber, ETag: part.etag })) },
    }));
    return NextResponse.json({ ok: true, storage_key: body.key });
  } catch (error) {
    console.error("R2 multipart complete failed", error);
    return NextResponse.json({ error: "تکمیل آپلود در فضای ذخیره‌سازی ناموفق بود." }, { status: 502 });
  }
}
