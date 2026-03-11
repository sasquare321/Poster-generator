import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic";

function getTodayDateIST() {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(now); // YYYY-MM-DD
}

export async function GET(req: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection(
      process.env.MONGODB_BG_COLLECTION || "Bgimgs"
    );

    const { searchParams } = new URL(req.url);
    const requestedDate = searchParams.get("date") || getTodayDateIST();

    const bgDoc = await collection.findOne({
      type: "background",
      date: requestedDate,
    });

    if (!bgDoc || !bgDoc.image) {
      return new NextResponse(
        `No background image found for date ${requestedDate}`,
        { status: 404 }
      );
    }

    let imageBuffer: Buffer;

    if (Buffer.isBuffer(bgDoc.image?.buffer)) {
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
    if (extension === ".gif") contentType = "image/gif";

    return new NextResponse(new Uint8Array(imageBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(imageBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[bg route] fetch error:", error);
    return new NextResponse("Failed to fetch background image", { status: 500 });
  }
}