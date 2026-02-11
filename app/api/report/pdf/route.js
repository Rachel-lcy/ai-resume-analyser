// app/api/report/pdf/route.js

import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

/** ---------------------------
 * Helpers
 * -------------------------- */
function safeArray(x) {
  return Array.isArray(x) ? x : [];
}
function pickTop(arr, n = 10) {
  return safeArray(arr).slice(0, n);
}
function clampText(str = "", max = 160) {
  const s = String(str ?? "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
function pct(value) {
  if (typeof value !== "number") return "--";
  if (value <= 1) return String(Math.round(value * 100)) + "%";
  return String(Math.round(value)) + "%";
}

function resolveFontPath(rel) {
  const candidates = [
    path.join(process.cwd(), "app", rel),
    path.join(process.cwd(), rel),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function readFontBuffer(relPath) {
  const p = resolveFontPath(relPath);
  if (!fs.existsSync(p)) throw new Error("Font file not found: " + p);
  return fs.readFileSync(p);
}

function bufferFromDoc(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function ensureSpace(doc, y, needed, margin = 40) {
  const bottomSafe = doc.page.height - margin;
  if (y + needed > bottomSafe) {
    doc.addPage();
    return margin;
  }
  return y;
}

/** ---------------------------
 * UI drawing
 * -------------------------- */
function drawPageBackground(doc) {
  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#F3F4F6");
  doc.restore();
}

function drawCard(doc, x, y, w, h, opts = {}) {
  const radius = opts.radius ?? 14;
  const fill = opts.fill ?? "#FFFFFF";
  const stroke = opts.stroke ?? "#E5E7EB";
  const lineWidth = opts.lineWidth ?? 1;

  doc.save();
  doc.roundedRect(x, y + 2, w, h, radius).fillColor("#000000").opacity(0.06).fill();
  doc.opacity(1);

  doc.roundedRect(x, y, w, h, radius).lineWidth(lineWidth);
  doc.fillColor(fill).fill();
  doc.strokeColor(stroke).stroke();
  doc.restore();
}

// ✅ Header：subtitle 两行（meta + 文件名），不显示 File:
function drawHeaderBar(doc, pageW, margin, title, subtitle) {
  const x = margin;
  const y = margin;
  const w = pageW - margin * 2;
  const h = 76;

  doc.save();
  doc.roundedRect(x, y, w, h, 16).fillColor("#1F2A8A").fill();
  doc.restore();

  doc.font("Inter-Bold").fillColor("#FFFFFF").fontSize(18);
  doc.text(title, x + 18, y + 12, { width: w - 36 });

  const subtitleBoxY = y + 36;
  const subtitleBoxH = 34;
  doc.font("Inter-Regular").fillColor("#DCE2FF").fontSize(10);
  doc.text(subtitle, x + 18, subtitleBoxY, {
    width: w - 36,
    height: subtitleBoxH,
    lineBreak: true,
  });

  return y + h + 16;
}

function drawSectionTitle(doc, x, y, title, w) {
  const titleToLineGap = 20;
  const lineToNextGap = 25;

  doc.font("Inter-Bold").fillColor("#111827").fontSize(16);
  doc.text(title, x, y);

  y += 16 + titleToLineGap;
  doc.moveTo(x, y).lineTo(x + w, y).lineWidth(1).strokeColor("#E5E7EB").stroke();
  return y + lineToNextGap;
}

function drawScoreCard(doc, x, y, w, h, title, desc, score, extraLine) {
  drawCard(doc, x, y, w, h, { radius: 14 });

  doc.font("Inter-SemiBold").fillColor("#111827").fontSize(12);
  doc.text(title, x + 16, y + 14, { width: w - 32 });

  doc.font("Inter-Regular").fillColor("#6B7280").fontSize(9);
  doc.text(desc, x + 16, y + 34, { width: w - 32 });

  doc.font("Inter-Regular").fillColor("#6B7280").fontSize(9);
  doc.text(extraLine || " ", x + 16, y + 50, { width: w - 32 });

  doc.font("Inter-Bold").fillColor("#111827").fontSize(44);
  doc.text(String(score ?? "--"), x, y + 56, { width: w, align: "center" });
}

function measureListCardHeight(doc, w, items) {
  const paddingX = 16;
  const paddingTop = 14;
  const titleGap = 10;
  const bulletGap = 12;
  const contentW = w - paddingX * 2 - bulletGap;

  const list = safeArray(items);

  doc.font("Inter-Regular").fontSize(10);
  const itemHeights = list.map((t) => doc.heightOfString(clampText(t, 240), { width: contentW }));

  const itemsHeight = list.length
    ? itemHeights.reduce((a, b) => a + b, 0) + (list.length - 1) * 6
    : doc.heightOfString("No items.", { width: contentW });

  const headerH = paddingTop + 12 + titleGap;
  const contentH = 12 + itemsHeight;
  return headerH + contentH + 14;
}

function drawListCard(doc, x, y, w, title, items, opts = {}) {
  const fixedHeight = opts.fixedHeight;

  const paddingX = 16;
  const paddingTop = 14;
  const titleGap = 10;
  const bulletGap = 12;
  const contentW = w - paddingX * 2 - bulletGap;

  const list = safeArray(items);
  const h = fixedHeight ?? measureListCardHeight(doc, w, list);

  drawCard(doc, x, y, w, h, { radius: 14 });

  doc.font("Inter-SemiBold").fillColor("#111827").fontSize(12);
  doc.text(title, x + paddingX, y + paddingTop, { width: w - paddingX * 2 });

  const contentTopY = y + paddingTop + 12 + titleGap;
  const contentBottomY = y + h - 14;
  let ty = contentTopY;

  doc.font("Inter-Regular").fillColor("#374151").fontSize(10);

  if (!list.length) {
    if (ty + 12 <= contentBottomY) {
      doc.fillColor("#9CA3AF").text("No items.", x + paddingX, ty, { width: w - paddingX * 2 });
    }
    return { h };
  }

  for (let i = 0; i < list.length; i++) {
    const t = clampText(list[i], 240);
    const itemH = doc.heightOfString(t, { width: contentW });
    if (ty + itemH > contentBottomY) break;

    doc.fillColor("#6B7280").text("•", x + paddingX, ty);
    doc.fillColor("#374151").text(t, x + paddingX + bulletGap, ty, { width: contentW });
    ty += itemH + 6;
  }

  return { h };
}

function drawFooter(doc, margin) {
  doc.font("Inter-Regular").fillColor("#9CA3AF").fontSize(8);
  doc.text("Generated by AI Resume Analyzer", margin, doc.page.height - 28, {
    width: doc.page.width - margin * 2,
    align: "center",
  });
}

/** ---------------------------
 * Route handlers
 * -------------------------- */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.report) {
      return Response.json({ error: "Missing report in request body." }, { status: 400 });
    }

    const fontRegular = readFontBuffer("assets/fonts/Inter-Regular.ttf");
    const fontSemiBold = readFontBuffer("assets/fonts/Inter-SemiBold.ttf");
    const fontBold = readFontBuffer("assets/fonts/Inter-Bold.ttf");

    const report = body.report;
    const meta = body.meta || {};
    const fileName = body.fileName || "";
    const jobDescription = body.jobDescription || "";

    const jobMatch = report?.scores?.jobMatchScore ?? null;
    const strength = report?.scores?.resumeStrengthScore ?? null;
    const coverage = report?.skills?.coverage;

    const matchedSkills = pickTop(report?.skills?.matchedSkills, 10);
    const missingSkills = pickTop(report?.skills?.missingSkills, 10);

    const doingWell = pickTop(report?.insights?.doingWell, 3);
    const fallsShort = pickTop(report?.insights?.fallsShort, 3);
    const improvements = pickTop(report?.improvements?.recommended, 5);

    const aiStatus = meta?.aiStatus ?? "unknown";
    const modelId = meta?.modelId ?? report?.meta?.model ?? "";
    const region = meta?.region ?? "";

    const doc = new PDFDocument({ size: "A4", margin: 40 });

    doc.registerFont("Inter-Regular", fontRegular);
    doc.registerFont("Inter-SemiBold", fontSemiBold);
    doc.registerFont("Inter-Bold", fontBold);
    doc.font("Inter-Regular");

    doc.on("pageAdded", () => {
      drawPageBackground(doc);
      doc.font("Inter-Regular");
    });

    const margin = doc.page.margins.left;
    const pageW = doc.page.width;

    drawPageBackground(doc);

    // ✅ 第一行 meta；第二行文件名（不带 File:）
    const subtitleParts = [];
    if (aiStatus) subtitleParts.push("AI: " + aiStatus);
    if (region) subtitleParts.push("Region: " + region);
    if (modelId) subtitleParts.push("Model: " + modelId);

    const metaLine = subtitleParts.join("  •  ");
    const subtitle = fileName ? metaLine + "\n" + fileName : metaLine;

    let y = drawHeaderBar(doc, pageW, margin, "AI Resume Analysis Report", subtitle);

    const gap = 16;
    const cardW = (pageW - margin * 2 - gap) / 2;

    // Row 1: Scores
    const scoreCardH = 160;
    y = ensureSpace(doc, y, scoreCardH + 10, margin);

    drawScoreCard(
      doc,
      margin,
      y,
      cardW,
      scoreCardH,
      "Job Match Score",
      "How well your resume matches this job description",
      jobMatch,
      typeof coverage === "number" ? "Skill coverage: " + pct(coverage) : ""
    );

    drawScoreCard(
      doc,
      margin + cardW + gap,
      y,
      cardW,
      scoreCardH,
      "Resume Strength Score",
      "How strong your resume is based on analysis",
      strength,
      ""
    );

    y += scoreCardH + 18;

    // Row 2: Skills (同行等高)
    const skillsHL = measureListCardHeight(doc, cardW, matchedSkills);
    const skillsHR = measureListCardHeight(doc, cardW, missingSkills);
    const skillsRowH = Math.max(skillsHL, skillsHR);

    y = ensureSpace(doc, y, skillsRowH + 10, margin);

    drawListCard(doc, margin, y, cardW, "Matched skills", matchedSkills, { fixedHeight: skillsRowH });
    drawListCard(doc, margin + cardW + gap, y, cardW, "Missing skills", missingSkills, { fixedHeight: skillsRowH });

    y += skillsRowH + 18;

    // Section: Insights
    y = ensureSpace(doc, y, 70, margin);
    y = drawSectionTitle(doc, margin, y, "AI Resume Insights", pageW - margin * 2);

    const insightHL = measureListCardHeight(doc, cardW, doingWell);
    const insightHR = measureListCardHeight(doc, cardW, fallsShort);
    const insightRowH = Math.max(insightHL, insightHR);

    y = ensureSpace(doc, y, insightRowH + 10, margin);

    drawListCard(doc, margin, y, cardW, "What you're doing well", doingWell, { fixedHeight: insightRowH });
    drawListCard(doc, margin + cardW + gap, y, cardW, "Where your resume falls short", fallsShort, { fixedHeight: insightRowH });

    y += insightRowH + 18;

    // Section: Improvements
    y = ensureSpace(doc, y, 70, margin);
    y = drawSectionTitle(doc, margin, y, "How to Improve Your Resume for This Role", pageW - margin * 2);

    const improveW = pageW - margin * 2;
    const improveH = measureListCardHeight(doc, improveW, improvements);

    y = ensureSpace(doc, y, improveH + 10, margin);
    const improveCard = drawListCard(doc, margin, y, improveW, "Recommended improvements", improvements, { fixedHeight: improveH });
    y += improveCard.h + 14;

    // ✅ Job description snippet：放不下就不画，避免空白页
    const jdSnippet = clampText(jobDescription.replace(/\s+/g, " ").trim(), 260);
    if (jdSnippet) {
      const snippetH = 72;
      const bottomSafe = doc.page.height - margin;
      const canFit = y + snippetH + 10 <= bottomSafe;

      if (canFit) {
        drawCard(doc, margin, y, pageW - margin * 2, snippetH, {
          radius: 14,
          fill: "#F9FAFB",
          stroke: "#E5E7EB",
        });

        doc.font("Inter-SemiBold").fillColor("#111827").fontSize(11);
        doc.text("Job description snippet", margin + 16, y + 12);

        doc.font("Inter-Regular").fillColor("#4B5563").fontSize(9);
        doc.text(jdSnippet, margin + 16, y + 30, { width: pageW - margin * 2 - 32 });

        y += snippetH + 8;
      }
    }

    drawFooter(doc, margin);

    const pdfBuffer = await bufferFromDoc(doc);

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume-report.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[pdf] error:", e);
    return Response.json({ error: e?.message || "PDF export failed" }, { status: 500 });
  }
}


export async function GET() {
  return Response.json({ ok: true, service: "report/pdf" });
}
