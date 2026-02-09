"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "../components/header";
import Image from "next/image";
import Link from "next/link";

function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function toPercent(value) {
  // 如果 value 已经是 0-100 的整数，就直接加 %
  // 未来改成 0-1 的小数，也能兼容
  if (typeof value !== "number") return "";
  if (value <= 1) return `${Math.round(value * 100)}%`;
  return `${Math.round(value)}%`;
}

export default function SuccessScore() {
  const [status, setStatus] = useState("loading"); // loading | ready | empty | error
  const [report, setReport] = useState(null);

  const [meta, setMeta] =useState(null);

  useEffect(() => {
    // 上传页/分析页把 report 存到 sessionStorage: "ai_resume_report"
    const raw = sessionStorage.getItem("ai_resume_report");
    const metaRaw = sessionStorage.getItem("ai_resume_meta")
    if (!raw) {
      setStatus("empty");
      return;
    }

    const parsed = safeParseJSON(raw);
    if (!parsed?.scores) {
      setStatus("error");
      return;
    }

    setReport(parsed);

    const parsedMeta = metaRaw? safeParseJSON(metaRaw) : null;
    setMeta(parsedMeta);

    console.log("metaRaw:", metaRaw);
    console.log("meta:", parsedMeta);


    setStatus("ready")
  }, []);


  const jobMatch = report?.scores?.jobMatchScore ?? null;
  const strength = report?.scores?.resumeStrengthScore ?? null;

  const doingWell = useMemo(() => report?.insights?.doingWell ?? [], [report]);
  const fallsShort = useMemo(() => report?.insights?.fallsShort ?? [], [report]);
  const improvements = useMemo(
    () => report?.improvements?.recommended ?? [],
    [report]
  );

  const matchedSkills = useMemo(
    () => report?.skills?.matchedSkills ?? [],
    [report]
  );
  const missingSkills = useMemo(
    () => report?.skills?.missingSkills ?? [],
    [report]
  );

  const coverage = report?.skills?.coverage;

  const handleDownload = () => {
    if (!report) return;

    //blob ≈ 一个临时生成的 resume-report.json 文件
    const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
    //生成临时可访问的本地URL
    const url = URL.createObjectURL(blob);

    //创建<a>超链接
    const a = document.createElement("a");
    a.href = url;
    //设置下载文件名
    a.download = `resume-report-${report?.meta?.reportId || "report"}.json`;
    //先下载
    a.click();
    //再释放内存
    URL.revokeObjectURL(url);

    //Dev-only：只在本地开发时显示（Vercel 生产环境不显示）
    const showDevDebug =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Header meta={meta}/>

        {/* Top banner */}
        <div className="rounded-lg bg-indigo-800 px-8 py-6 text-base font-semibold text-white">
          {status === "loading" && <p>Generating AI insights…</p>}
          {status === "ready" && <p>AI insights generated successfully!</p>}
          {status === "empty" && <p>No report found. Please upload a resume first.</p>}
          {status === "error" && <p>Report data is corrupted. Please try again.</p>}
        </div>

        {/* Empty / Error CTA */}
        {(status === "empty" || status === "error") && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-gray-700">
              This page needs a report generated from the upload step.
            </p>
            <div className="mt-4 flex gap-3">
              <Link
                href="/"
                className="inline-flex items-center rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800"
              >
                Back to Upload
              </Link>
              <button
                onClick={() => sessionStorage.removeItem("ai_resume_report")}
                className="inline-flex items-center rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Clear saved report
              </button>
            </div>
          </div>
        )}

        {/* Main content */}
        {status === "ready" && (
          <>
            {/* Score cards */}
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Job Match Score:
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    How well your resume matches this job description
                  </p>
                  {typeof coverage === "number" && (
                    <p className="mt-2 text-sm text-gray-500">
                      Skill coverage: <span className="font-semibold">{toPercent(coverage)}</span>
                    </p>
                  )}
                </div>

                <div className="mt-10 flex items-center justify-center">
                  <p className="text-7xl font-extrabold text-black">
                    {jobMatch ?? "--"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Resume Strength Score:
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    How strong your resume is based on AI analysis
                  </p>
                </div>

                <div className="mt-10 flex items-center justify-center">
                  <p className="text-7xl font-extrabold text-black">
                    {strength ?? "--"}
                  </p>
                </div>
              </div>
            </div>

            {/* Skills Overview section */}
            <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900">Skills Overview</h3>

              <div className="mt-4 grid gap-6 md:grid-cols-2">
                <div>
                  <p className="font-medium text-gray-900">Matched skills</p>
                  {matchedSkills.length ? (
                    <ul className="mt-3 list-disc list-inside space-y-1 text-gray-700">
                      {matchedSkills.slice(0, 10).map((s, idx) => (
                        <li key={`m-${idx}`}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">No matched skills detected.</p>
                  )}
                </div>

                <div>
                  <p className="font-medium text-gray-900">Missing skills</p>
                  {missingSkills.length ? (
                    <ul className="mt-3 list-disc list-inside space-y-1 text-gray-700">
                      {missingSkills.slice(0, 10).map((s, idx) => (
                        <li key={`x-${idx}`}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">No major skill gaps detected.</p>
                  )}
                </div>
              </div>
            </div>

            {/* AI Resume Insights */}
            <div>
              <h1 className="text-3xl font-bold mt-8 tracking-wide">
                🔎 AI Resume Insights
              </h1>

              <div className="mt-8">
                <h3 className="text-xl font-medium text-gray-900">
                  - What You’re Doing Well
                </h3>

                {doingWell.length ? (
                  <ul className="mt-4 list-disc list-inside space-y-2 text-base text-gray-600">
                    {doingWell.map((t, idx) => (
                      <li key={`dw-${idx}`}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">
                    No insights available.
                  </p>
                )}
              </div>

              <div className="mt-10">
                <h3 className="text-xl font-medium text-gray-900">
                  - Where Your Resume Falls Short
                </h3>

                {fallsShort.length ? (
                  <ul className="mt-4 list-disc list-inside space-y-2 text-base text-gray-600">
                    {fallsShort.map((t, idx) => (
                      <li key={`fs-${idx}`}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">
                    No gaps detected.
                  </p>
                )}
              </div>
            </div>

            {/* Improvements */}
            <div>
              <h1 className="text-3xl font-bold mt-8 tracking-wide">
                🔎 How to Improve Your Resume for This Role
              </h1>

              <div className="mt-8">
                <h3 className="text-xl font-medium text-gray-900">
                  - Recommended Improvements
                </h3>

                {improvements.length ? (
                  <ul className="mt-4 list-disc list-inside space-y-2 text-base text-gray-600">
                    {improvements.map((t, idx) => (
                      <li key={`im-${idx}`}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">
                    No recommendations available.
                  </p>
                )}
              </div>
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="group mt-8 inline-flex items-center gap-2 rounded-2xl border border-indigo-700 px-5 py-2.5 font-semibold text-indigo-900 hover:bg-indigo-50"
            >
              <Image
                src="/icons/download.png"
                alt="Download"
                width={18}
                height={18}
                className="transition-transform group-hover:translate-y-0.5"
              />
              <span>Download Report</span>
            </button>
          </>
        )}
      </div>
    </main>
  );
}
