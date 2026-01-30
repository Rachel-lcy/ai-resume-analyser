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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampText(str = "", maxLen = 8000) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function validateInput({ jobDescription, resumeText }) {
  const jd = (jobDescription || "").trim();
  const rt = (resumeText || "").trim();

  // MVP：JD 必填（因为 match score 依赖 JD）
  if (!jd) {
    return { ok: false, message: "Job description is required." };
  }

  // MVP：resumeText 先不强制（后面你做 PDF -> text 后可改成必填）
  if (!rt) {
    return { ok: true, warning: "Resume text is empty (MVP allowed)." };
  }

  return { ok: true };
}

function buildMockReport({ resumeText, jobDescription }) {
  // 做一点“看起来合理”的假分析逻辑
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
    // 1) 读取请求体 JSON（如果不是 JSON 就给空对象）
    const body = await req.json().catch(() => ({}));

    // 2) 允许前端控制“模拟成功/失败 + 延迟”
    const simulate = body.simulate; // "success" | "fail" | undefined
    const delayMs = Number.isFinite(body.delayMs) ? body.delayMs : 900;

    // 3) 读取输入，并做长度截断（避免未来接 LLM 时爆 token）
    const resumeText = clampText(body.resumeText || "", 8000);
    const jobDescription = clampText(body.jobDescription || "", 4000);

    // 4) 模拟“生成耗时”
    await sleep(delayMs);

    // 5) 输入校验（JD 必填，resumeText MVP 可选）
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

    // 6) 决定这次是否失败（用于测试 fails 页面）
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

    // 7) 成功：生成 mock report 并返回
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
    // 8) 兜底：防止服务端异常把整个 API 打崩
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
  return NextResponse.json({ ok: true, service: "analyze-mock", version: "v1" });
}
