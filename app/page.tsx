"use client";

import { useEffect, useRef, useState } from "react";
import { toBlob, toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import { BsGeoAltFill, BsEnvelopeFill } from "react-icons/bs";

type PriceData = {
  gold: number;
  silver: number;
  date: string;
};

type Palette = {
  bgBase: string;
  bgDark: string;
  gold: string;
  goldSoft: string;
};

const POSTER_WIDTH = 1080;
const POSTER_HEIGHT = 1620;
const POSTER_RATIO = POSTER_HEIGHT / POSTER_WIDTH;

const EXPORT_SCALE = 2.2;
const EXPORT_WIDTH = Math.round(POSTER_WIDTH * EXPORT_SCALE);
const EXPORT_HEIGHT = Math.round(POSTER_HEIGHT * EXPORT_SCALE);

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd} | ${mm} | ${yyyy}`;
  } catch {
    return dateStr;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;

  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function mix(hex1: string, hex2: string, amount: number) {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  const t = clamp(amount, 0, 1);
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t
  );
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const arr = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * arr[0] + 0.7152 * arr[1] + 0.0722 * arr[2];
}

function createPalette(baseHex: string): Palette {
  const baseLum = luminance(baseHex);
  const warmGold = "#d9a441";

  const bgBase =
    baseLum > 0.3 ? mix(baseHex, "#2b0c05", 0.55) : mix(baseHex, "#1b0603", 0.45);
  const bgDark = mix(bgBase, "#050100", 0.72);
  const gold = mix(warmGold, "#f3c96a", 0.35);
  const goldSoft = mix(gold, "#fff1c6", 0.28);

  return { bgBase, bgDark, gold, goldSoft };
}

async function extractPaletteFromImage(src: string): Promise<Palette> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) {
          resolve(createPalette("#3a1209"));
          return;
        }

        const w = 60;
        const h = 60;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const { data } = ctx.getImageData(0, 0, w, h);

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const rr = data[i];
          const gg = data[i + 1];
          const bb = data[i + 2];
          const alpha = data[i + 3];

          if (alpha < 120) continue;
          const brightness = (rr + gg + bb) / 3;
          if (brightness > 220 || brightness < 18) continue;

          r += rr;
          g += gg;
          b += bb;
          count++;
        }

        if (!count) {
          resolve(createPalette("#3a1209"));
          return;
        }

        resolve(createPalette(rgbToHex(r / count, g / count, b / count)));
      } catch {
        resolve(createPalette("#3a1209"));
      }
    };

    img.onerror = () => resolve(createPalette("#3a1209"));
    img.src = src;
  });
}

function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
    })
  ).then(() => undefined);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise
      .then((value) => {
        clearTimeout(id);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(id);
        reject(err);
      });
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RateImageCard({
  imageSrc,
  label,
  value,
  labelColor,
  valueColor,
  labelSize = "24px",
  valueSize = "66px",
}: {
  imageSrc: string;
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
  labelSize?: string;
  valueSize?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        position: "relative",
        height: "238px",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      <img
        src={imageSrc}
        alt={label}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "fill",
          display: "block",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "28px 20px 18px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontSize: labelSize,
            lineHeight: 1.1,
            fontWeight: 700,
            fontFamily: "Georgia, serif",
            color: labelColor,
            marginBottom: "18px",
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize: valueSize,
            lineHeight: 1,
            fontWeight: 800,
            fontFamily: "Arial, Helvetica, sans-serif",
            color: valueColor,
            letterSpacing: "-0.03em",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function PosterContent({
  prices,
  bgUrl,
}: {
  prices: PriceData | null;
  bgUrl: string;
}) {
  const goldVal = prices ? `₹${prices.gold.toLocaleString("en-IN")}/-` : "—";
  const silverVal = prices ? `₹${prices.silver.toLocaleString("en-IN")}/-` : "—";
  const shortDate = prices ? formatDate(prices.date) : "06 | 03 | 2026";

  return (
    <div
      style={{
        width: `${POSTER_WIDTH}px`,
        height: `${POSTER_HEIGHT}px`,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#210604",
        boxShadow: "0 28px 80px rgba(0,0,0,0.92)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#210604",
          backgroundImage: bgUrl ? `url('${bgUrl}')` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center 8%",
          backgroundRepeat: "no-repeat",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.04) 18%, rgba(0,0,0,0.10) 56%, rgba(0,0,0,0.42) 80%, rgba(0,0,0,0.72) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "30px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "500px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "22px",
          zIndex: 5,
        }}
      >
        <img
          src="/assets/916.png"
          alt="BIS 916"
          style={{
            height: "74px",
            objectFit: "contain",
            filter: "brightness(1.05) drop-shadow(0 2px 10px rgba(0,0,0,0.45))",
          }}
        />
        <img
          src="/assets/SMS.png"
          alt="SMS Jewellers"
          style={{
            height: "64px",
            objectFit: "contain",
            filter: "brightness(1.05) drop-shadow(0 2px 10px rgba(0,0,0,0.45))",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: "168px",
          left: "80px",
          right: "80px",
          height: "2px",
          zIndex: 4,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(194,143,49,0.55) 14%, rgba(194,143,49,0.55) 86%, transparent 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "140px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "610px",
          height: "62px",
          borderRadius: "999px",
          zIndex: 5,
          background:
            "linear-gradient(180deg, #f1cb73 0%, #e2b24b 44%, #c88720 100%)",
          border: "1.5px solid rgba(168,108,22,0.75)",
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,240,185,0.4), inset 0 -1px 0 rgba(110,63,10,0.24)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            fontSize: "24px",
            color: "#301608",
            letterSpacing: "0.01em",
          }}
        >
          Welcome To The Home Of Trust
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: "220px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "860px",
          textAlign: "center",
          zIndex: 5,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: "85px",
          lineHeight: 1.02,
          letterSpacing: "-0.02em",
          color: "#f3e7ce",
          textShadow: "0 4px 16px rgba(0,0,0,0.25)",
          whiteSpace: "nowrap",
        }}
      >
        Today&apos;s Gold Rate
      </div>

      <div
        style={{
          position: "absolute",
          top: "338px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "320px",
          height: "52px",
          borderRadius: "999px",
          zIndex: 5,
          background: "rgba(18, 10, 8, 0.72)",
          border: "1.3px solid rgba(198,147,53,0.65)",
          boxShadow: "inset 0 1px 0 rgba(255,220,140,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            fontSize: "25px",
            color: "#e2b554",
            letterSpacing: "0.22em",
          }}
        >
          {shortDate}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: "56px",
          right: "56px",
          bottom: "245px",
          display: "flex",
          gap: "26px",
          zIndex: 5,
        }}
      >
        <RateImageCard
          imageSrc="/assets/gold.png"
          label="Gold Per Gram"
          value={goldVal}
          labelColor="#4a2506"
          valueColor="#231004"
          labelSize="35px"
          valueSize="65px"
        />
        <RateImageCard
          imageSrc="/assets/silver.png"
          label="Silver Per Gram"
          value={silverVal}
          labelColor="#433c38"
          valueColor="#211a17"
          labelSize="35px"
          valueSize="65px"
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "175px",
          zIndex: 6,
          background:
            "linear-gradient(180deg, rgba(16,7,5,0.95) 0%, rgba(28,10,7,0.97) 100%)",
          borderTop: "1px solid rgba(214,158,70,0.35)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: "2px",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(224,171,80,0.8) 22%, rgba(224,171,80,0.8) 78%, transparent 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: "66px",
            borderBottom: "1px solid rgba(190,130,52,0.32)",
          }}
        >
          <img
            src="/assets/left.png"
            alt="Left ornament"
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "112px",
              height: "50px",
              objectFit: "contain",
            }}
          />

          <img
            src="/assets/right.png"
            alt="Right ornament"
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "112px",
              height: "50px",
              objectFit: "contain",
            }}
          />

          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              fontFamily: "Georgia, serif",
              fontWeight: 500,
              fontSize: "30px",
              color: "#f1e2c7",
              whiteSpace: "nowrap",
              textShadow: "0 2px 8px rgba(0,0,0,0.25)",
            }}
          >
            Daily Gold Rate Updates • Custom Jewellery Available
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "66px",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(188,126,46,0.42) 14%, rgba(188,126,46,0.42) 86%, transparent 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "102px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          <BsGeoAltFill
            style={{
              fontSize: "20px",
              color: "#f5f0ea",
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontFamily: "Arial, Helvetica, sans-serif",
              fontWeight: 700,
              fontSize: "25px",
              color: "#f5f0ea",
              letterSpacing: "0.01em",
            }}
          >
            No: 112, Bazaar Street, Tiruvallur - 602001
          </div>
          <div
            style={{
              fontSize: "20px",
              color: "#f5f0ea",
              fontWeight: 700,
              marginInline: "6px",
            }}
          >
            |
          </div>
          <BsEnvelopeFill
            style={{
              fontSize: "20px",
              color: "#f5f0ea",
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontFamily: "Arial, Helvetica, sans-serif",
              fontWeight: 700,
              fontSize: "23px",
              color: "#f5f0ea",
              letterSpacing: "0.01em",
            }}
          >
            smsjewellers377@gmail.com
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const previewRef = useRef<HTMLDivElement>(null);
  const exportPosterRef = useRef<HTMLDivElement>(null);

  const [prices, setPrices] = useState<PriceData | null>(null);
  const [downloading, setDownloading] = useState<false | "png" | "pdf">(false);
  const [bgUrl, setBgUrl] = useState("");
  const [palette, setPalette] = useState<Palette>(createPalette("#3a1209"));
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    fetch("/api/prices/latest", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setPrices({ gold: d.gold, silver: d.silver, date: d.date });
        }
      })
      .catch((error) => {
        console.error("Price fetch failed:", error);
      });
  }, []);

  useEffect(() => {
    if (!prices?.date) return;

    const nextBgUrl = `/api/bg?date=${encodeURIComponent(prices.date)}&t=${Date.now()}`;
    setBgUrl(nextBgUrl);

    extractPaletteFromImage(nextBgUrl)
      .then(setPalette)
      .catch(() => setPalette(createPalette("#3a1209")));
  }, [prices]);

  useEffect(() => {
    const updateScale = () => {
      if (!previewRef.current) return;
      const availableWidth = previewRef.current.offsetWidth;
      const nextScale = Math.min(1, availableWidth / POSTER_WIDTH);
      setPreviewScale(nextScale);
    };

    updateScale();

    const observer = new ResizeObserver(() => updateScale());
    if (previewRef.current) observer.observe(previewRef.current);

    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  const getHighResPngBlob = async () => {
    if (!exportPosterRef.current) return null;

    await waitForImages(exportPosterRef.current);

    return await withTimeout(
      toBlob(exportPosterRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        canvasWidth: EXPORT_WIDTH,
        canvasHeight: EXPORT_HEIGHT,
        backgroundColor: "#210604",
        skipFonts: false,
      }),
      20000,
      "PNG export"
    );
  };

  const getPdfJpegDataUrl = async () => {
    if (!exportPosterRef.current) return null;

    await waitForImages(exportPosterRef.current);

    return await withTimeout(
      toJpeg(exportPosterRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        canvasWidth: EXPORT_WIDTH,
        canvasHeight: EXPORT_HEIGHT,
        backgroundColor: "#210604",
        quality: 0.9,
        skipFonts: false,
      }),
      20000,
      "PDF export"
    );
  };

  const downloadPNG = async () => {
    setDownloading("png");
    try {
      const blob = await getHighResPngBlob();
      if (!blob) throw new Error("PNG blob generation failed");

      downloadBlob(blob, "sms-jewellers-gold-rate.png");
    } catch (error) {
      console.error("PNG export failed:", error);
      alert("PNG export failed. Check that /api/bg and /api/prices/latest are working and try again.");
    } finally {
      setDownloading(false);
    }
  };

  const downloadPDF = async () => {
    setDownloading("pdf");
    try {
      const jpegDataUrl = await getPdfJpegDataUrl();
      if (!jpegDataUrl) throw new Error("PDF image generation failed");

      const pdfW = 210;
      const pdfH = pdfW * POSTER_RATIO;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pdfW, pdfH],
        compress: true,
      });

      pdf.addImage(jpegDataUrl, "JPEG", 0, 0, pdfW, pdfH, undefined, "MEDIUM");
      pdf.save("sms-jewellers-gold-rate.pdf");
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("PDF export failed. Check that /api/bg and /api/prices/latest are working and try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: palette.bgDark,
        padding: "16px",
        gap: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        ref={previewRef}
        style={{
          width: "100%",
          maxWidth: "1080px",
        }}
      >
        <div
          style={{
            width: "100%",
            height: `${POSTER_HEIGHT * previewScale}px`,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${POSTER_WIDTH}px`,
              height: `${POSTER_HEIGHT}px`,
              transform: `scale(${previewScale})`,
              transformOrigin: "top left",
            }}
          >
            <PosterContent prices={prices} bgUrl={bgUrl} />
          </div>
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          left: "-20000px",
          top: 0,
          width: `${POSTER_WIDTH}px`,
          height: `${POSTER_HEIGHT}px`,
          pointerEvents: "none",
          opacity: 1,
        }}
      >
        <div ref={exportPosterRef}>
          <PosterContent prices={prices} bgUrl={bgUrl} />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <button
          onClick={downloadPNG}
          disabled={!!downloading}
          style={{
            padding: "14px 40px",
            background: `linear-gradient(135deg, ${mix(
              palette.gold,
              "#b57112",
              0.2
            )}, ${palette.goldSoft}, ${mix(palette.gold, "#b57112", 0.2)})`,
            border: `2px solid ${mix(palette.goldSoft, palette.gold, 0.3)}`,
            borderRadius: "10px",
            color: "#160500",
            fontSize: "17px",
            fontWeight: 800,
            letterSpacing: "0.12em",
            cursor: downloading ? "wait" : "pointer",
            fontFamily: "Georgia, serif",
            textTransform: "uppercase",
            boxShadow: "0 6px 22px rgba(0,0,0,0.48)",
            opacity: downloading ? 0.7 : 1,
          }}
        >
          {downloading === "png" ? "Generating PNG…" : "⬇ Download PNG"}
        </button>

        <button
          onClick={downloadPDF}
          disabled={!!downloading}
          style={{
            padding: "14px 40px",
            background: `linear-gradient(135deg, ${mix(
              palette.bgDark,
              "#120501",
              0.15
            )}, ${mix(palette.bgBase, palette.bgDark, 0.5)}, ${mix(
              palette.bgDark,
              "#120501",
              0.15
            )})`,
            border: `2px solid ${mix(palette.gold, palette.bgDark, 0.2)}`,
            borderRadius: "10px",
            color: palette.goldSoft,
            fontSize: "17px",
            fontWeight: 800,
            letterSpacing: "0.12em",
            cursor: downloading ? "wait" : "pointer",
            fontFamily: "Georgia, serif",
            textTransform: "uppercase",
            boxShadow: "0 6px 22px rgba(0,0,0,0.48)",
            opacity: downloading ? 0.7 : 1,
          }}
        >
          {downloading === "pdf" ? "Generating PDF…" : "⬇ Download PDF"}
        </button>
      </div>
    </main>
  );
}