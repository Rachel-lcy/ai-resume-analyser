import { NextResponse } from "next/server";

/**
 * Mock AI Resume Analyzer API (MVP)
 * POST /api/analyze
 *
 * Body example:
 * {
 *   resumeText?: string,
 *   jobDescription: string,
 *   simulate?: "success" | "fail",
 *   delayMs?: number
 * }
 */

/**
 * Phase 1: Real Upload Flow (MVP)
 * POST /api/analyze
 * Content-Type: multipart/form-data
 *
 * Fields:
 * - resume: File (PDF)
 * - jobDescription: string
 * - simulate?: "success" | "fail" (optional)
 * - delayMs?: number (optional)
 *
 * Return:
 * - { ok: true, report: {...}, warning?: string | null }
 */


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampText(str = "", maxLen = 8000) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

/**
 * Phase1 规则：
 * - JD 必填
 * - resume 文件必填（你前端也要求）
 * - resumeText 暂不强制（Phase2 会从 PDF 解析出来再启用）
 */

function validateInput({ jobDescription, resumeText }) {
  const jd = (jobDescription || "").trim();
  const rt = (resumeText || "").trim();

  // MVP：JD 必填（因为 match score 依赖 JD）
  if (!jd) {
    return { ok: false, message: "Job description is required." };
  }

  //  Phase1：不强制 resumeText（因为我们还没做 PDF->text）
  if (!rt) {
    return { ok: true, warning: "Resume text is empty (Phase1 allowed)." };
  }

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
    (s) =>
      jdLower.includes(s.toLowerCase()) &&
      resumeLower.includes(s.toLowerCase())
  );

  const coreSkills = matchedSkills.length
    ? matchedSkills.slice(0, 8)
    : ["AWS", "Serverless", "Next.js", "React", "Python"];

  // 让分数“有规律但不离谱”
  const jobFitScore = Math.min(95, 60 + coreSkills.length * 5); // 60~95
  const resumeStrengthScore = Math.min(
    92,
    55 + Math.floor(coreSkills.length * 4.5)
  ); // 55~92

  return {
    meta: {
      reportId: `rpt_${Date.now()}`,
      createdAt: new Date().toISOString(),
      model: "mock-v1",
    },
    scores: {
      jobMatchScore: jobFitScore,
      resumeStrengthScore: resumeStrengthScore,
    },
    insights: {
      doingWell: [
        "Clear project-based experience demonstrating practical skills",
        "Good alignment with serverless / cloud-native patterns",
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
      "Walk me through the architecture of your most recent serverless project.",
      "How would you handle retries, rate limits, and failures in an AI-powered workflow?",
      "How do you evaluate whether an AI feature is actually helping users?",
    ],
    debug: {
      resumeTextLength: (resumeText || "").length,
      jobDescriptionLength: (jobDescription || "").length,
      matchedSkills,
    },
  };
}

export async function POST(req) {
  try {
    // 1) 从 multipart/form-data 读取（phase1 的关键点）
    const formData = await req.formData();

    //2) 读取字段： file + jd + simulate/delayMs(optional)
    const file = formData.get("resume")
    const jobDescriptionRaw = formData.get("jobDescription");
    const simulateRaw = formData.get("simulate")
    const delayMsRaw = formData.get(delayMs)

    const jobDescription = clampText((jobDescriptionRaw || "").toString(), 4000);

    // simulate: "success" | "fail" | undefined
    const simulate = (simulateRaw || "").toString() || undefined;

     // delayMs: number
    const delayMsParsed = Number(delayMsRaw);
    const delayMs = Number.isFinite(delayMsParsed) ? delayMsParsed : 900;

    // 3) 校验：文件必须存在
    if(!file){
      return NextResponse.json(
        {
          ok: false,
          error: { code: "FILE_REQUIRED", message: "Resume PDF is required." },
        },
        {status: 400}
      )
    }

     // 4) 校验：确保是 File 对象（防止传错）
     if(typeof file === "string || !file.name"){
      return NextResponse.json(
        {
          ok: false,
          error: { code: "INVALID_FILE", message: "Invalid file upload." },
        },
        { status: 400 }
      )
     }

      // 5) 校验：必须 PDF（type 或扩展名）
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endWith(".pdf")

        if(!isPdf){
          return NextResponse.json(
            {
              ok: false,
              error: { code: "PDF_ONLY", message: "Please upload a PDF file." },
            },
            { status: 400 }
          )
        }

      //6) 校验：大小限制（与前端一致）

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

       // 7) Phase1：我们还不解析 PDF → resumeText 暂为空
        // Phase2 你会在这里把 PDF 转成文本：resumeText = extractedText
        const resumeText = "";

        // 8) 模拟耗时
        await sleep(delayMs);


        // 9) 业务输入校验：JD 必填（你原逻辑保留）
      const validation = validateInput({ jobDescription, resumeText });
        if (!validation.ok) {
          return NextResponse.json(
            {
              ok: false,
              error: {
                code: "VALIDATION_ERROR",
                message: validation.message,
              },
            },
            { status: 400 }
          );
        }


    // 10) 决定这次是否失败
    const randomFail = Math.random() < 0.15; // 15% 随机失败
    const shouldFail =
      simulate === "fail" ? true : simulate === "success" ? false : randomFail;

    if (shouldFail) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "ANALYSIS_FAILED",
            message:
              "We couldn't analyze your resume at this time. Please try again.",
          },
        },
        { status: 500 }
      );
    }

    // 11) 成功：生成 report 并返回
    const report = buildMockReport({ resumeText, jobDescription });

    return NextResponse.json(
      {
        ok: true,
        report,
        warning: validation.warning || null,
      },
      { status: 200 }
    );
  } catch (err) {

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message: "Unexpected server error.",
        },
      },
      { status: 500 }
    );
  }
}

// 可选：GET 用于快速探活（浏览器直接打开能看到）
export async function GET() {
  return NextResponse.json({ ok: true, service: "analyze-mvp", version: "phase1" });
}
