import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection(
      process.env.MONGODB_PRICES_COLLECTION || "Prices"
    );

    const priceDoc = await collection.findOne(
      {},
      {
        sort: { date: -1 },
        projection: { _id: 0, gold: 1, silver: 1, date: 1 },
      }
    );

    if (!priceDoc) {
      return NextResponse.json(
        { success: false, message: "No prices found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      gold: priceDoc.gold,
      silver: priceDoc.silver,
      date: priceDoc.date,
    });
  } catch (error) {
    console.error("[prices/latest] fetch error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch prices" },
      { status: 500 }
    );
  }
}