import { NextResponse } from "next/server";

export const runtime = "nodejs"; // Node 环境解析 PDF

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampText(str = "", maxLen = 12000) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function normalizeText(text = "") {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function validateInput({ jobDescription, resumeText }) {
  const jd = (jobDescription || "").trim();
  const rt = (resumeText || "").trim();

  if (!jd) return { ok: false, message: "Job description is required." };
  if (!rt) return { ok: false, message: "Unable to extract text from the PDF." };

  return { ok: true };
}

function buildMockReport({ resumeText, jobDescription }) {
  const jdLower = (jobDescription || "").toLowerCase();
  const resumeLower = (resumeText || "").toLowerCase();

  const skillPool = [
    "AWS",
    "Lambda",
    "API Gateway",
    "S3",
    "DynamoDB",
    "Next.js",
    "React",
    "Node.js",
    "Python",
    "SQL",
    "CI/CD",
    "Cloud Security",
    "GenAI",
  ];

  const matchedSkills = skillPool.filter(
    (s) => jdLower.includes(s.toLowerCase()) && resumeLower.includes(s.toLowerCase())
  );

  const coreSkills = matchedSkills.length
    ? matchedSkills.slice(0, 8)
    : ["AWS", "Serverless", "Next.js", "React", "Python"];

  const jobFitScore = Math.min(95, 60 + coreSkills.length * 5);
  const resumeStrengthScore = Math.min(92, 55 + Math.floor(coreSkills.length * 4.5));

  return {
    meta: {
      reportId: `rpt_${Date.now()}`,
      createdAt: new Date().toISOString(),
      model: "mock-v2-pdfjs-text",
    },
    scores: {
      jobMatchScore: jobFitScore,
      resumeStrengthScore: resumeStrengthScore,
    },
    insights: {
      doingWell: [
        "Clear project-based experience demonstrating practical skills",
        "Good alignment with cloud-native patterns",
        "Readable structure with consistent section headings",
      ],
      fallsShort: [
        "Missing measurable impact (numbers / outcomes) in some bullet points",
        "Some key skills from the job description are not explicitly mentioned",
        "Add a short summary tailored to the target role",
      ],
    },
    improvements: {
      recommended: [
        "Add 2–3 quantified achievements (e.g., reduced time by X%, improved performance by Y%)",
        "Include missing keywords from the job description naturally in experience bullets",
        "Create a dedicated ‘Cloud & AI Projects’ section with 2–3 highlights",
      ],
    },
    interviewQuestions: [
      "Walk me through the architecture of your most recent project.",
      "How would you handle retries, rate limits, and failures in an AI-powered workflow?",
      "How do you evaluate whether an AI feature is actually helping users?",
    ],
    debug: {
      resumeTextLength: resumeText.length,
      jobDescriptionLength: jobDescription.length,
      matchedSkills,
      resumePreview: resumeText.slice(0, 300),
    },
  };
}

// legacy pdfjs 抽文本：Node 环境必须用 legacy + 指定 workerSrc
async function extractTextFromPdfArrayBuffer(pdfjsLib, arrayBuffer) {
  const uint8 = new Uint8Array(arrayBuffer);

  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    // 但关键是 workerSrc 指向 legacy worker
    disableWorker: true,
  });

  const pdf = await loadingTask.promise;

  let extracted = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => (typeof item?.str === "string" ? item.str : ""))
      .join(" ");
    extracted += pageText + "\n";
  }

  return extracted;
}

export async function POST(req) {
  try {
    // 关键：只用 legacy build（避免 DOMMatrix 报错）
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // 关键：workerSrc 指向 legacy worker（你目录里就有这个文件）
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    const formData = await req.formData();

    const file = formData.get("resume");
    const jobDescriptionRaw = formData.get("jobDescription");
    const simulateRaw = formData.get("simulate");
    const delayMsRaw = formData.get("delayMs");

    const jobDescription = clampText((jobDescriptionRaw || "").toString(), 4000);
    const simulate = (simulateRaw || "").toString() || undefined;

    const delayMsParsed = Number(delayMsRaw);
    const delayMs = Number.isFinite(delayMsParsed) ? delayMsParsed : 900;

    // 1) 文件校验
    if (!file) {
      return NextResponse.json(
        { ok: false, error: { code: "FILE_REQUIRED", message: "Resume PDF is required." } },
        { status: 400 }
      );
    }

    if (typeof file === "string" || !file.name) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_FILE", message: "Invalid file upload." } },
        { status: 400 }
      );
    }

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return NextResponse.json(
        { ok: false, error: { code: "PDF_ONLY", message: "Please upload a PDF file." } },
        { status: 400 }
      );
    }

    const maxSizeMB = 10;
    if (file.size > maxSizeMB * 1024 * 1024) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: `File is too large. Please upload a PDF under ${maxSizeMB}MB.`,
          },
        },
        { status: 400 }
      );
    }

    // 2) 模拟耗时
    await sleep(delayMs);

    // 3) PDF -> Text
    let resumeText = "";
    try {
      const arrayBuffer = await file.arrayBuffer();
      const rawText = await extractTextFromPdfArrayBuffer(pdfjsLib, arrayBuffer);
      resumeText = clampText(normalizeText(rawText || ""), 12000);
    } catch (e) {
      console.error("PDF parse failed:", e);
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "PDF_PARSE_FAILED",
            message: "Failed to extract text from the PDF.",
            detail: String(e?.message || e),
          },
        },
        { status: 422 }
      );
    }

    // 4) 业务校验
    const validation = validateInput({ jobDescription, resumeText });
    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: validation.message } },
        { status: 400 }
      );
    }

    // 5) 模拟失败/成功
    const shouldFail =
      simulate === "fail" ? true : simulate === "success" ? false : false;

    if (shouldFail) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "ANALYSIS_FAILED",
            message: "We couldn't analyze your resume at this time. Please try again.",
          },
        },
        { status: 500 }
      );
    }

    // 6) 成功返回 report
    const report = buildMockReport({ resumeText, jobDescription });
    return NextResponse.json({ ok: true, report }, { status: 200 });
  } catch (err) {
    console.error("POST /api/analyze unexpected error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message: "Unexpected server error.",
          detail: String(err?.message || err),
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "analyze-mvp", version: "phase2-pdfjs" });
}
