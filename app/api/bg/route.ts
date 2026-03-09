import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection(process.env.MONGODB_BG_COLLECTION || "Bgimgs");

    const bgDoc = await collection.findOne(
      { type: "background" },
      { sort: { date: -1 } }
    );

    if (!bgDoc || !bgDoc.image) {
      return new NextResponse("No background image found", { status: 404 });
    }

    let imageBuffer: Buffer;

    if (Buffer.isBuffer(bgDoc.image.buffer)) {
      imageBuffer = bgDoc.image.buffer;
    } else if (Buffer.isBuffer(bgDoc.image)) {
      imageBuffer = bgDoc.image;
    } else if (bgDoc.image?.buffer) {
      imageBuffer = Buffer.from(bgDoc.image.buffer);
    } else {
      return new NextResponse("Invalid image format", { status: 500 });
    }

    const extension = (bgDoc.extension || ".png").toLowerCase();

    let contentType = "image/png";
    if (extension === ".jpg" || extension === ".jpeg") contentType = "image/jpeg";
    if (extension === ".webp") contentType = "image/webp";

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[bg route] fetch error:", error);
    return new NextResponse("Failed to fetch background image", { status: 500 });
  }
}