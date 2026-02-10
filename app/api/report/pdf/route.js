import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

/**
 * POST /api/report/pdf
 * Body: { report, meta, jobDescription, fileName }
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const report = body?.report || {};
    const meta = body?.meta || {};
    const jobDescription = (body?.jobDescription || "").toString();
    const fileName = (body?.fileName || "").toString();

    // ---------- Fonts (Inter) ----------
    const fontDir = path.join(process.cwd(), "app", "assets", "fonts");
    const fontRegular = path.join(fontDir, "Inter-Regular.ttf");
    const fontSemiBold = path.join(fontDir, "Inter-SemiBold.ttf");
    const fontBold = path.join(fontDir, "Inter-Bold.ttf");


    [fontRegular, fontSemiBold, fontBold].forEach((p) => {
      if (!fs.existsSync(p)) {
        throw new Error(`Font file missing: ${p}`);
      }
    });

    // ---------- PDF base ----------
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 44, bottom: 44, left: 44, right: 44 },
      autoFirstPage: true,
    });

    // collect buffers
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));

    const done = new Promise((resolve, reject) => {
      doc.on("end", resolve);
      doc.on("error", reject);
    });

    doc.registerFont("Inter-Regular", fontRegular);
    doc.registerFont("Inter-SemiBold", fontSemiBold);
    doc.registerFont("Inter-Bold", fontBold);
    doc.font("Inter-Regular");

    // ---------- Theme ----------
    const page = {
      w: doc.page.width,
      h: doc.page.height,
      left: doc.page.margins.left,
      right: doc.page.width - doc.page.margins.right,
      top: doc.page.margins.top,
      bottom: doc.page.height - doc.page.margins.bottom,
    };

    const COLORS = {
      navy: "#1E2A78",
      ink: "#111827",
      sub: "#6B7280",
      border: "#E5E7EB",
      bg: "#FFFFFF",
      cardBg: "#FFFFFF",
      soft: "#F9FAFB",
    };

    const gap = 14;
    const cardRadius = 14;

    function clampText(s, max = 240) {
      const str = (s || "").toString().replace(/\s+/g, " ").trim();
      if (!str) return "";
      return str.length > max ? str.slice(0, max - 1) + "…" : str;
    }

    // ---------- Layout helpers ----------
    function ensureSpace(heightNeeded) {
      if (doc.y + heightNeeded <= page.bottom) return;
      doc.addPage();
      doc.font("Inter-Regular");
      doc.fillColor(COLORS.ink);
      doc.y = page.top;
    }

    function roundRect(x, y, w, h, r) {
      doc.roundedRect(x, y, w, h, r);
    }

    function drawCard(x, y, w, h, { fill = COLORS.cardBg, stroke = COLORS.border } = {}) {
      doc.save();
      roundRect(x, y, w, h, cardRadius);
      doc.fillColor(fill).fill();
      doc.strokeColor(stroke).lineWidth(1).stroke();
      doc.restore();
    }

    function textHeight(text, width, options = {}) {
      return doc.heightOfString((text || "").toString(), {
        width,
        ...options,
      });
    }

    function bulletListHeight(items, width, options = {}) {
      const arr = Array.isArray(items) ? items : [];
      if (!arr.length) return 0;
      let h = 0;
      for (const it of arr) {
        const t = (it || "").toString();
        // 子弹点本身占一行高度（用 indent + hanging indent）
        h += textHeight(t, width, { ...options }) + 6;
      }
      return h;
    }

    function drawSectionTitle(title, icon = null) {
      doc.font("Inter-Bold").fontSize(16).fillColor(COLORS.ink);
      doc.text(title, page.left, doc.y, { width: page.right - page.left });
      doc.moveDown(0.4);
      doc.font("Inter-Regular").fontSize(11).fillColor(COLORS.sub);
    }

    function drawBulletList(items, x, y, width, { fontSize = 11, lineGap = 2 } = {}) {
      const arr = Array.isArray(items) ? items : [];
      let cy = y;
      doc.font("Inter-Regular").fontSize(fontSize).fillColor(COLORS.ink);

      for (const it of arr) {
        const text = (it || "").toString().trim();
        if (!text) continue;


        const h = textHeight(text, width - 14, { lineGap }) + 6;
        ensureSpace(h + 4);


        doc.circle(x + 4, cy + 6, 1.6).fill(COLORS.ink);
        doc.fillColor(COLORS.ink).text(text, x + 14, cy, {
          width: width - 14,
          lineGap,
        });
        cy += h;
      }
      return cy;
    }

    // card content block: returns used height
    function drawCardBlock({
      x,
      y,
      w,
      title,
      subtitle,
      contentRenderer, // (innerX, innerY, innerW) => innerEndY
      minH = 0,
    }) {
      const padX = 18;
      const padY = 16;
      const innerX = x + padX;
      const innerW = w - padX * 2;

      doc.save();
      doc.font("Inter-SemiBold").fontSize(12).fillColor(COLORS.ink);
      let cy = y + padY;

      if (title) {
        const th = textHeight(title, innerW);
        cy += th;
        doc.text(title, innerX, y + padY, { width: innerW });
        cy += 8;
      }

      if (subtitle) {
        doc.font("Inter-Regular").fontSize(10).fillColor(COLORS.sub);
        const sh = textHeight(subtitle, innerW);
        doc.text(subtitle, innerX, cy - 2, { width: innerW });
        cy += sh + 10;
        doc.font("Inter-Regular").fontSize(11).fillColor(COLORS.ink);
      }


      const startY = cy;
      const endY = contentRenderer ? contentRenderer(innerX, cy, innerW) : cy;
      const contentH = endY - (y + padY);

      const cardH = Math.max(minH, contentH + padY);
      doc.restore();

      return cardH;
    }


    function renderCard({
      x,
      w,
      title,
      subtitle,
      measureContentHeight, // (innerW) => height
      renderContent, // (innerX, innerY, innerW) => endY
      minH = 0,
    }) {
      const padX = 18;
      const padY = 16;
      const innerW = w - padX * 2;


      doc.font("Inter-SemiBold").fontSize(12);
      let h = padY;

      if (title) h += textHeight(title, innerW) + 8;
      if (subtitle) {
        doc.font("Inter-Regular").fontSize(10);
        h += textHeight(subtitle, innerW) + 10;
      }

      const contentH = measureContentHeight ? measureContentHeight(innerW) : 0;
      h += contentH + padY;

      const cardH = Math.max(minH, h);


      ensureSpace(cardH);


      const y = doc.y;
      drawCard(x, y, w, cardH, { fill: COLORS.cardBg, stroke: COLORS.border });


      let cy = y + padY;
      const innerX = x + padX;

      if (title) {
        doc.font("Inter-SemiBold").fontSize(12).fillColor(COLORS.ink);
        doc.text(title, innerX, cy, { width: innerW });
        cy += textHeight(title, innerW) + 8;
      }
      if (subtitle) {
        doc.font("Inter-Regular").fontSize(10).fillColor(COLORS.sub);
        doc.text(subtitle, innerX, cy, { width: innerW });
        cy += textHeight(subtitle, innerW) + 10;
      }

      doc.font("Inter-Regular").fontSize(11).fillColor(COLORS.ink);
      const endY = renderContent ? renderContent(innerX, cy, innerW) : cy;


      doc.y = y + cardH + gap;
      return endY;
    }

    // ---------- Data ----------
    const scores = report?.scores || {};
    const skills = report?.skills || {};
    const insights = report?.insights || {};
    const improvements = report?.improvements || {};

    const jobMatchScore = scores?.jobMatchScore ?? "--";
    const strengthScore = scores?.resumeStrengthScore ?? "--";
    const coverage = typeof skills?.coverage === "number" ? Math.round(skills.coverage * 100) + "%" : "";

    const matchedSkills = Array.isArray(skills?.matchedSkills) ? skills.matchedSkills.slice(0, 10) : [];
    const missingSkills = Array.isArray(skills?.missingSkills) ? skills.missingSkills.slice(0, 10) : [];

    const doingWell = Array.isArray(insights?.doingWell) ? insights.doingWell.slice(0, 6) : [];
    const fallsShort = Array.isArray(insights?.fallsShort) ? insights.fallsShort.slice(0, 6) : [];
    const recs = Array.isArray(improvements?.recommended) ? improvements.recommended.slice(0, 10) : [];

    const aiStatus = meta?.aiStatus || "unknown";
    const region = meta?.region || "";
    const modelId = meta?.modelId || "";

    // ---------- Header (Hero Card) ----------

    const heroH = 86;
    ensureSpace(heroH);

    const heroX = page.left;
    const heroW = page.right - page.left;
    const heroY = doc.y;

    doc.save();
    doc.roundedRect(heroX, heroY, heroW, heroH, 16).fill(COLORS.navy);
    doc.restore();

    doc.fillColor("#FFFFFF").font("Inter-Bold").fontSize(20);
    doc.text("AI Resume Analysis Report", heroX + 20, heroY + 18, {
      width: heroW - 40,
    });

    doc.font("Inter-Regular").fontSize(9).fillColor("#DCE3FF");
    const metaLine = [
      `AI: ${aiStatus}`,
      region ? `Region: ${region}` : null,
      modelId ? `Model: ${modelId}` : null,
      fileName ? `File: ${fileName}` : null,
    ]
      .filter(Boolean)
      .join("  •  ");

    doc.text(metaLine, heroX + 20, heroY + 48, {
      width: heroW - 40,
      lineGap: 2,
    });

    doc.y = heroY + heroH + 18;

    // ---------- Two score cards ----------
    const colGap = 16;
    const colW = (heroW - colGap) / 2;
    const leftX = page.left;
    const rightX = page.left + colW + colGap;

    // left Job Match
    renderCard({
      x: leftX,
      w: colW,
      title: "Job Match Score",
      subtitle: `How well your resume matches this job description${coverage ? `\nSkill coverage: ${coverage}` : ""}`,
      minH: 150,
      measureContentHeight: () => 0,
      renderContent: (x, y, w) => {
        doc.font("Inter-Bold").fontSize(54).fillColor(COLORS.ink);
        doc.text(String(jobMatchScore), x, y + 12, { width: w, align: "center" });
        return y + 90;
      },
    });

    // right Strength

    const rowTopY = heroY + heroH + 18;
    const afterLeftY = doc.y;

    // 把 y 回到这一行顶部再画右卡
    doc.y = rowTopY;
    renderCard({
      x: rightX,
      w: colW,
      title: "Resume Strength Score",
      subtitle: "How strong your resume is based on analysis",
      minH: 150,
      measureContentHeight: () => 0,
      renderContent: (x, y, w) => {
        doc.font("Inter-Bold").fontSize(54).fillColor(COLORS.ink);
        doc.text(String(strengthScore), x, y + 12, { width: w, align: "center" });
        return y + 90;
      },
    });


    doc.y = Math.max(afterLeftY, doc.y) + 6;

    // ---------- Skills overview card (2 columns inside) ----------
    renderCard({
      x: page.left,
      w: heroW,
      title: "Skills Overview",
      subtitle: "",
      measureContentHeight: (innerW) => {
        const half = (innerW - 18) / 2;
        doc.font("Inter-SemiBold").fontSize(11);
        let h = 0;
        h += textHeight("Matched skills", half) + 8;
        h += bulletListHeight(matchedSkills, half - 14, { fontSize: 11, lineGap: 2 });
        h += 10;
        h = Math.max(
          h,
          textHeight("Missing skills", half) +
            8 +
            bulletListHeight(missingSkills, half - 14, { fontSize: 11, lineGap: 2 }) +
            10
        );
        return h;
      },
      renderContent: (x, y, innerW) => {
        const half = (innerW - 18) / 2;
        const left = x;
        const right = x + half + 18;

        // Left
        doc.font("Inter-SemiBold").fontSize(11).fillColor(COLORS.ink);
        doc.text("Matched skills", left, y, { width: half });
        let cyL = y + 18;
        cyL = drawBulletList(matchedSkills, left, cyL, half, { fontSize: 11 });

        // Right
        doc.font("Inter-SemiBold").fontSize(11).fillColor(COLORS.ink);
        doc.text("Missing skills", right, y, { width: half });
        let cyR = y + 18;
        cyR = drawBulletList(missingSkills, right, cyR, half, { fontSize: 11 });

        return Math.max(cyL, cyR);
      },
    });

    // ---------- AI Resume Insights (two cards in a row) ----------
    doc.font("Inter-Bold").fontSize(16).fillColor(COLORS.ink);
    doc.text("AI Resume Insights", page.left, doc.y, { width: heroW });
    doc.moveDown(0.6);

    const insightsRowTop = doc.y;

    // measure both cards to decide page break BEFORE drawing
    const insightsCardMinH = 170;

    // left: doing well
    const doingH = (() => {
      doc.font("Inter-Regular").fontSize(11);
      return bulletListHeight(doingWell, colW - 18 * 2 - 14, { fontSize: 11, lineGap: 2 });
    })();
    const fallsH = (() => {
      doc.font("Inter-Regular").fontSize(11);
      return bulletListHeight(fallsShort, colW - 18 * 2 - 14, { fontSize: 11, lineGap: 2 });
    })();

    const needRowH = Math.max(insightsCardMinH, 16 + 12 + 8 + doingH + 18);
    ensureSpace(needRowH);

    // Draw left insights card
    doc.y = insightsRowTop;
    renderCard({
      x: leftX,
      w: colW,
      title: "What you're doing well",
      subtitle: "",
      minH: insightsCardMinH,
      measureContentHeight: (innerW) => bulletListHeight(doingWell, innerW - 14, { fontSize: 11, lineGap: 2 }),
      renderContent: (x, y, w) => drawBulletList(doingWell, x, y, w, { fontSize: 11 }),
    });

    const afterDoingY = doc.y;

    // Draw right insights card (same row)
    doc.y = insightsRowTop;
    renderCard({
      x: rightX,
      w: colW,
      title: "Where your resume falls short",
      subtitle: "",
      minH: insightsCardMinH,
      measureContentHeight: (innerW) => bulletListHeight(fallsShort, innerW - 14, { fontSize: 11, lineGap: 2 }),
      renderContent: (x, y, w) => drawBulletList(fallsShort, x, y, w, { fontSize: 11 }),
    });

    doc.y = Math.max(afterDoingY, doc.y) + 8;

    // ---------- Improvements (single full-width card) ----------
    doc.font("Inter-Bold").fontSize(16).fillColor(COLORS.ink);
    doc.text("How to Improve Your Resume for This Role", page.left, doc.y, { width: heroW });
    doc.moveDown(0.6);

    renderCard({
      x: page.left,
      w: heroW,
      title: "Recommended improvements",
      subtitle: "",
      minH: 160,
      measureContentHeight: (innerW) => bulletListHeight(recs, innerW - 14, { fontSize: 11, lineGap: 2 }),
      renderContent: (x, y, w) => drawBulletList(recs, x, y, w, { fontSize: 11 }),
    });

    // ---------- Job description snippet (only if exists) ----------
    const jdSnippet = clampText(jobDescription, 520);
    if (jdSnippet) {
      renderCard({
        x: page.left,
        w: heroW,
        title: "Job description snippet",
        subtitle: "",
        minH: 110,
        measureContentHeight: (innerW) => textHeight(jdSnippet, innerW, { lineGap: 2 }),
        renderContent: (x, y, w) => {
          doc.font("Inter-Regular").fontSize(10).fillColor(COLORS.sub);
          doc.text(jdSnippet, x, y, { width: w, lineGap: 2 });
          return y + textHeight(jdSnippet, w, { lineGap: 2 });
        },
      });
    }

    // ---------- Footer (each page) ----------

    doc.font("Inter-Regular").fontSize(8).fillColor("#9CA3AF");
    doc.text("Generated by AI Resume Analyzer", page.left, page.bottom - 16, {
      width: heroW,
      align: "center",
    });

    doc.end();
    await done;

    const pdfBuffer = Buffer.concat(chunks);

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="resume-report-${report?.meta?.reportId || "report"}.pdf"`,
      },
    });
  } catch (e) {
    console.error("[pdf] error:", e);
    return Response.json(
      { error: e?.message || "PDF export failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({ ok: true, service: "report/pdf" });
}
