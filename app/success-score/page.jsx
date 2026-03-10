"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  if (typeof value !== "number") return "";
  if (value <= 1) return `${Math.round(value * 100)}%`;
  return `${Math.round(value)}%`;
}

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

export default function SuccessScore() {
  const [status, setStatus] = useState("loading");
  // loading | ready | empty | error
  const [report, setReport] = useState(null);
  const [meta, setMeta] = useState(null);

  // explain JSON: { breakdown, drivers, actions }
  const [explain, setExplain] = useState(null);
  const [explainStatus, setExplainStatus] = useState("idle"); // idle | loading | ready | error
  const [explainError, setExplainError] = useState("");

  // 读取 report/meta
  useEffect(() => {
    const raw = sessionStorage.getItem("ai_resume_report");
    const metaRaw = sessionStorage.getItem("ai_resume_meta");

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
    setMeta(metaRaw ? safeParseJSON(metaRaw) : null);
    setStatus("ready");
  }, []);

  const jobMatch = report?.scores?.jobMatchScore ?? null;
  const strength = report?.scores?.resumeStrengthScore ?? null;

  const doingWell = useMemo(() => report?.insights?.doingWell ?? [], [report]);
  const fallsShort = useMemo(() => report?.insights?.fallsShort ?? [], [report]);
  const improvements = useMemo(() => report?.improvements?.recommended ?? [], [report]);

  const matchedSkills = useMemo(() => report?.skills?.matchedSkills ?? [], [report]);
  const missingSkills = useMemo(() => report?.skills?.missingSkills ?? [], [report]);
  const coverage = report?.skills?.coverage;

  // ✅ 从 report.meta.scoreMeta 读取
  const scoreMeta = report?.meta?.scoreMeta || null;

  // 备用：从 report 内估算 skill count（如果 scoreMeta 没有）
  const resumeSkillCountFromReport = useMemo(() => {
    return (
      report?.skills?.resumeSkills?.length ??
      report?.skills?.allSkills?.length ??
      report?.resumeSkills?.length ??
      0
    );
  }, [report]);

  // ✅ runExplain：拿结构化 JSON（Breakdown/Drivers/Actions）
  const runExplain = useCallback(
    async (force = false) => {
      if (!report?.scores) return;

      const payload = {
        jobMatchScore: report?.scores?.jobMatchScore ?? 0,
        resumeStrengthScore: report?.scores?.resumeStrengthScore ?? 0,
        matched: report?.skills?.matchedSkills ?? [],
        missing: report?.skills?.missingSkills ?? [],
        coverage: report?.skills?.coverage ?? 0,
        jdTopSkills: report?.skills?.jdTopSkills ?? meta?.jdTopSkills ?? [],
        resumeSkillCount: resumeSkillCountFromReport ?? 0,
      };

      // ✅ 缓存 key：把 reportId + 分数拼进去，避免换 JD 但读旧缓存
      const reportId = report?.meta?.reportId || "latest";
      const cacheKey = `ai_explain_v2_${reportId}_${payload.jobMatchScore}_${payload.resumeStrengthScore}`;

      if (force) sessionStorage.removeItem(cacheKey);

      const cached = sessionStorage.getItem(cacheKey);
      if (cached && !force) {
        const cachedJson = safeParseJSON(cached);
        if (cachedJson) {
          setExplain(cachedJson);
          setExplainStatus("ready");
          return;
        }
        sessionStorage.removeItem(cacheKey);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        setExplainStatus("loading");
        setExplainError("");

        const res = await fetch("/api/analyze/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || `Explain API failed (${res.status}).`);
        }

        setExplain(data);
        setExplainStatus("ready");
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (e) {
        const msg =
          e?.name === "AbortError"
            ? "AI explanation timed out. Please try again."
            : (e?.message || "Failed to generate explanation.");

        setExplainStatus("error");
        setExplainError(msg);

        // fallback：也要把 strength 公式字段带上（旧公式）
        const usedCount = Math.min(payload.resumeSkillCount || 0, 20);
        const computedStrength = Math.min(55 + usedCount * 2, 100);

        const fallback = {
          breakdown: {
            jobMatchScore: payload.jobMatchScore,
            resumeStrengthScore: payload.resumeStrengthScore,
            coveragePct: Math.round((payload.coverage || 0) * 100),
            matchedCount: safeArray(payload.matched).length,
            jdCount: safeArray(payload.matched).length + safeArray(payload.missing).length,
            formula: "Job Match Score = 50 + coverage*50",

            resumeSkillCount: payload.resumeSkillCount,
            usedCount,
            computedStrength,
            strengthFormula: "Resume Strength Score = 55 + min(resume_skill_count, 20)*2",
          },
          drivers: {
            topMatched: safeArray(payload.matched).slice(0, 3),
            topMissing: safeArray(payload.missing).slice(0, 3),
          },
          actions: [
            {
              title: "Add 1 bullet proving a missing core skill",
              why: "Improves coverage and adds evidence.",
              impact: "+5 to +10",
            },
          ],
        };
        setExplain(fallback);
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [report, meta, resumeSkillCountFromReport]
  );

  // 自动触发一次
  useEffect(() => {
    if (status === "ready" && report?.scores && explainStatus === "idle") {
      runExplain(false);
    }
  }, [status, report, runExplain, explainStatus]);

  const handleDownloadPdf = async () => {
    try {
      if (!report) {
        alert("No report found.");
        return;
      }

      const jd = sessionStorage.getItem("ai_jd") || "";
      const fileName = sessionStorage.getItem("ai_fileName") || "";

      const res = await fetch("/api/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, meta, jobDescription: jd, fileName }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "PDF export failed.");
      }
    //blob ≈ 一个临时生成的 resume-report.json 文件
      const blob = await res.blob();
      //生成临时可访问的本地URL
      const url = URL.createObjectURL(blob);
      //创建<a>超链接
      const a = document.createElement("a");
      a.href = url;
      //设置下载文件名
      a.download = `resume-report-${report?.meta?.reportId || "report"}.pdf`;
      //先下载
      a.click();
      //再释放内存
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.message || "PDF export failed.");
    }
  };

  // 方便渲染
  const breakdown = explain?.breakdown || null;
  const drivers = explain?.drivers || null;
  const actions = safeArray(explain?.actions);


  const derivedResumeSkillCount =
    (typeof breakdown?.resumeSkillCount === "number"
      ? breakdown.resumeSkillCount
      : resumeSkillCountFromReport) ?? 0;

  const derivedUsedCount =
    (typeof breakdown?.usedCount === "number"
      ? breakdown.usedCount
      : Math.min(derivedResumeSkillCount, 20)) ?? 0;

  const derivedComputedStrength =
    (typeof breakdown?.computedStrength === "number"
      ? breakdown.computedStrength
      : Math.min(55 + derivedUsedCount * 2, 100)) ?? "--";


  const newBreakdown = scoreMeta?.breakdown || null;
  const newBase = typeof newBreakdown?.base === "number" ? newBreakdown.base : 40;
  const newBreadth = typeof newBreakdown?.breadth === "number" ? newBreakdown.breadth : 0;
  const newRelevance = typeof newBreakdown?.relevance === "number" ? newBreakdown.relevance : 0;
  const newEvidence = typeof newBreakdown?.evidence === "number" ? newBreakdown.evidence : 0;
  const newTotal = Math.min(newBase + newBreadth + newRelevance + newEvidence, 100);

  const newResumeSkillCount =
    typeof scoreMeta?.resumeSkillCount === "number" ? scoreMeta.resumeSkillCount : null;

  const newMatchedSkillCount =
    typeof scoreMeta?.matchedSkillCount === "number" ? scoreMeta.matchedSkillCount : null;

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Header  />

        <div className="rounded-lg bg-indigo-800 px-8 py-6 text-base font-semibold text-white">
          {status === "loading" && <p>Generating AI insights…</p>}
          {status === "ready" && <p>AI Analysis complete — here’s how your resume matches this role!</p>}
          {status === "empty" && <p>No report found. Please upload a resume first.</p>}
          {status === "error" && <p>Report data is corrupted. Please try again.</p>}
        </div>

        {(status === "empty" || status === "error") && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-gray-700">This page needs a report generated from the upload step.</p>
            <div className="mt-4 flex gap-3">
              <Link
                href="/"
                className="inline-flex items-center rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800"
              >
                Back to Upload
              </Link>
              <button
                onClick={() => {
                  sessionStorage.removeItem("ai_resume_report");
                  sessionStorage.removeItem("ai_resume_meta");
                }}
                className="inline-flex items-center rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Clear saved report
              </button>
            </div>
          </div>
        )}

        {status === "ready" && (
          <>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Job Match Score:</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Scores above 80 indicate strong alignment with the job description.
                  </p>
                </div>
                <div className="mt-10 flex items-center justify-center">
                  <p className="text-7xl font-extrabold text-black">{jobMatch ?? "--"}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Resume Strength Score:</h2>
                  <p className="mt-2 text-sm text-gray-600">How strong your resume is based on AI analysis</p>
                </div>
                <div className="mt-10 flex items-center justify-center">
                  <p className="text-7xl font-extrabold text-black">{strength ?? "--"}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900">Skills Overview</h3>

              <div className="mt-4 grid gap-6 md:grid-cols-2">
                <div>
                  <p className="font-bold text-indigo-900">Matched skills</p>
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
                  <p className="font-bold text-orange-900">Missing skills</p>
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

            {/* Score Breakdown Section */}
            <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                  🤖
                </span>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Score Breakdown</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Exactly why you got this score — and the fastest way to raise it.
                      </p>
                    </div>

                    {explainStatus === "loading" && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-gray-500" />
                        Generating
                      </span>
                    )}
                    {explainStatus === "ready" && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Ready
                      </span>
                    )}
                    {explainStatus === "error" && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                        <span className="h-2 w-2 rounded-full bg-orange-500" />
                        Fallback
                      </span>
                    )}
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 p-4">
                      <p className="text-xs font-semibold text-gray-500">JOB MATCH</p>
                      <p className="mt-2 text-3xl font-extrabold text-gray-900">
                        {breakdown?.jobMatchScore ?? jobMatch ?? "--"}
                      </p>
                      <p className="mt-2 text-sm text-gray-600">
                        Skill Coverage:{" "}
                        <span className="font-semibold">
                          {typeof breakdown?.coveragePct === "number"
                            ? `${breakdown.coveragePct}%`
                            : (typeof coverage === "number" ? toPercent(coverage) : "--")}
                        </span>
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        {breakdown?.formula || "Job Match Score = 50 + coverage*50"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4">
                      <p className="text-xs font-semibold text-gray-500">MATCHED vs JD</p>
                      <p className="mt-2 text-3xl font-extrabold text-gray-900">
                        {typeof breakdown?.matchedCount === "number" ? breakdown.matchedCount : matchedSkills.length}
                        <span className="text-gray-300"> / </span>
                        {typeof breakdown?.jdCount === "number"
                          ? breakdown.jdCount
                          : (matchedSkills.length + missingSkills.length || "--")}
                      </p>
                      <p className="mt-2 text-sm text-gray-600">Matched JD skills used for coverage.</p>
                    </div>

                    {/* ✅ RESUME STRENGTH：优先用新算法 scoreMeta；没有就回退旧公式 */}
                    {/* <div className="rounded-xl border border-gray-200 p-4">
                      <p className="text-xs font-semibold text-gray-500">RESUME STRENGTH</p>
                      <p className="mt-2 text-3xl font-extrabold text-gray-900">
                        {strength ?? "--"}
                      </p>

                      {scoreMeta?.breakdown ? (
                        <>
                          <p className="mt-2 text-xs text-gray-600">
                            {newBase} (base) + {newBreadth} (breadth) + {newRelevance} (relevance) + {newEvidence} (evidence)
                            {" "} = <span className="font-semibold">{newTotal}</span>
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            resume_skill_count={newResumeSkillCount ?? "--"}
                            {newMatchedSkillCount !== null ? `, matched_skill_count=${newMatchedSkillCount}` : ""}
                          </p>
                        </>
                      ) : (
                        <div className="mt-2 text-sm text-gray-600">
                          <div className="font-semibold text-gray-800">
                            55 + min({derivedResumeSkillCount}, 20) × 2 = {derivedComputedStrength}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            We counted <span className="font-semibold">{derivedResumeSkillCount}</span> skills and used{" "}
                            <span className="font-semibold">{derivedUsedCount}</span> (cap at 20).
                          </div>
                          <div className="mt-1 text-[11px] text-gray-500">
                            {breakdown?.strengthFormula || "Resume Strength Score = 55 + min(resume_skill_count, 20)*2"}
                          </div>
                        </div>
                      )}
                    </div> */}
                    <div className="rounded-xl border border-gray-200 p-4">
                      <p className="text-xs font-semibold text-gray-500">RESUME STRENGTH</p>

                      {/* 分数 */}
                      <p className="mt-2 text-3xl font-extrabold text-gray-900">
                        {strength ?? breakdown?.resumeStrengthScore ?? "--"}
                      </p>

                      {/* 给招聘者看的 */}
                      <p className="mt-2 text-sm text-gray-600">
                        {scoreMeta?.breakdown
                          ? "Computed from breadth + relevance + evidence (auditable)."
                          : "Based on skill breadth + evidence."}
                      </p>

                      {/* 公式一行 */}
                      {scoreMeta?.breakdown && (
                        <p className="mt-2 text-xs text-gray-700">
                          <span className="font-semibold">
                            {scoreMeta.breakdown.base} (base) + {scoreMeta.breakdown.breadth} (breadth) +{" "}
                            {scoreMeta.breakdown.relevance} (relevance) + {scoreMeta.breakdown.evidence} (evidence)
                          </span>
                          {" "}={" "}
                          <span className="font-semibold">
                            {Math.min(
                              100,
                              (scoreMeta.breakdown.base || 0) +
                                (scoreMeta.breakdown.breadth || 0) +
                                (scoreMeta.breakdown.relevance || 0) +
                                (scoreMeta.breakdown.evidence || 0)
                            )}
                          </span>
                        </p>
                      )}

                      {/* 折叠section：详细算法（给企业/招聘者审计） */}
                      <details className="mt-3 w-full rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <summary className="cursor-pointer select-none text-sm font-semibold text-gray-800 py-2 px-2">
                          View scoring details (for recruiters)
                        </summary>

                        <div className="mt-3 space-y-3 text-sm text-gray-700">
                          {/* 本次计算输入 */}
                          <div className="mt-3 w-full rounded-xl border border-gray-200 bg-white p-3">
                            <p className="text-xs font-semibold text-gray-500">Inputs used</p>

                            <div className="mt-2 grid w-full grid-cols-1 gap-3 lg:grid-cols-2">
                              <div className="min-w-0 rounded-lg bg-gray-50 p-3">
                                <p className="text-xs text-gray-500 break-words">resume_skill_count</p>
                                <p className="mt-1 text-lg font-semibold text-gray-900">
                                  {scoreMeta?.resumeSkillCount ?? "--"}
                                </p>
                                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                                  Unique skills extracted from resume (deduplicated).
                                </p>
                              </div>

                              <div className="min-w-0 rounded-lg bg-gray-50 p-3">
                                <p className="text-xs text-gray-500 break-words">matched_skill_count</p>
                                <p className="mt-1 text-lg font-semibold text-gray-900">
                                  {scoreMeta?.matchedSkillCount ?? "--"}
                                </p>
                                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                                  Skills that overlap between JD skills and resume skills.
                                </p>
                              </div>
                            </div>
                          </div>


                          {/* 算法定义 */}
                          <div className="rounded-lg bg-white p-3 border border-gray-200">
                            <p className="text-xs font-semibold text-gray-500">Formula</p>
                            <p className="mt-2 font-mono text-xs text-gray-700">
                              Resume Strength = 40 + breadth + relevance + evidence (cap at 100)
                            </p>

                            <div className="mt-3 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold">Breadth (0–40)</p>
                                  <p className="text-xs text-gray-500">
                                    breadth = min(resume_skill_count, 20) × 2
                                  </p>
                                </div>
                                <p className="font-semibold">{scoreMeta?.breakdown?.breadth ?? "--"}</p>
                              </div>

                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold">Relevance (0–20)</p>
                                  <p className="text-xs text-gray-500">
                                    relevance = min(matched_skill_count, 10) × 2
                                  </p>
                                </div>
                                <p className="font-semibold">{scoreMeta?.breakdown?.relevance ?? "--"}</p>
                              </div>

                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold">Evidence (0–20)</p>
                                  <p className="text-xs text-gray-500">
                                    evidence is estimated from resume bullets (verbs + metrics + project signals)
                                  </p>
                                </div>
                                <p className="font-semibold">{scoreMeta?.breakdown?.evidence ?? "--"}</p>
                              </div>
                            </div>
                          </div>

                          {/* Evidence 的启发式 */}
                          <div className="rounded-lg bg-white p-3 border border-gray-200">
                            <p className="text-xs font-semibold text-gray-500">Evidence scoring heuristic (0–20)</p>
                            <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-gray-600">
                              <li>Action verbs (max 10): built / implemented / optimized / deployed …</li>
                              <li>Metrics (max 8): numbers, %, ms/sec, users, requests, etc.</li>
                              <li>Project signals (max 2): project/portfolio/api/full-stack/Next.js/React/AWS…</li>
                            </ul>
                            <p className="mt-2 text-xs text-gray-500">
                              Tip: Add 1–2 quantified bullets (Action + Tool + Result) to raise evidence fast.
                            </p>
                          </div>


                          <p className="text-xs text-gray-500 py-2 px-2">
                            We keep these details collapsed to reduce UI noise for candidates, while still making the score auditable for employers.
                          </p>
                        </div>
                      </details>
                    </div>
                  </div>

                  {/* Drivers */}
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                          ✅
                        </span>
                        <p className="font-semibold text-gray-900">Top drivers (matched)</p>
                      </div>

                      {explainStatus === "loading" ? (
                        <div className="mt-3 space-y-2">
                          <div className="h-3 w-10/12 rounded-full bg-gray-100" />
                          <div className="h-3 w-8/12 rounded-full bg-gray-100" />
                        </div>
                      ) : (
                        <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-gray-700">
                          {(safeArray(drivers?.topMatched).length ? drivers.topMatched : matchedSkills.slice(0, 3)).map(
                            (s, idx) => <li key={`tm-${idx}`}>{s}</li>
                          )}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                          ⚠️
                        </span>
                        <p className="font-semibold text-gray-900">Top drivers (missing)</p>
                      </div>

                      {explainStatus === "loading" ? (
                        <div className="mt-3 space-y-2">
                          <div className="h-3 w-11/12 rounded-full bg-gray-100" />
                          <div className="h-3 w-9/12 rounded-full bg-gray-100" />
                        </div>
                      ) : (
                        <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-gray-700">
                          {(safeArray(drivers?.topMissing).length ? drivers.topMissing : missingSkills.slice(0, 3)).map(
                            (s, idx) => <li key={`tx-${idx}`}>{s}</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                          🚀
                        </span>
                        <p className="font-semibold text-gray-900">Fastest ways to increase score</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => runExplain(true)}
                        className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Regenerate
                      </button>
                    </div>

                    {explainStatus === "loading" ? (
                      <div className="mt-4 space-y-3">
                        <div className="h-3 w-11/12 rounded-full bg-gray-100" />
                        <div className="h-3 w-10/12 rounded-full bg-gray-100" />
                        <div className="h-3 w-9/12 rounded-full bg-gray-100" />
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {(actions.length ? actions : []).map((a, idx) => (
                          <div key={`ac-${idx}`} className="rounded-xl bg-gray-50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold text-gray-900">{a?.title}</p>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-200">
                                Impact: {a?.impact || "+3 to +10"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-gray-600">{a?.why}</p>
                          </div>
                        ))}

                        {!actions.length && (
                          <p className="text-sm text-gray-600">No actions available. Try regenerating.</p>
                        )}
                      </div>
                    )}

                    {explainStatus === "error" && (
                      <p className="mt-3 text-sm text-orange-600">
                        AI request had an issue, so we displayed a safe fallback
                        {explainError ? ` (${explainError})` : ""}.
                      </p>
                    )}

                    <p className="mt-3 text-xs text-gray-500">
                      Tip: Use <span className="font-semibold text-gray-700">Action + Tool + Result</span> in bullet points.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insights */}
            <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="mt-10">
                <div className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    🔎
                  </span>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                      AI Resume Insights <span className="text-gray-400 font-medium"> · Why this matters</span>
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Key strengths and gaps identified from your resume and the job description.
                    </p>
                  </div>
                </div>
                <div className="mt-6 h-px w-full bg-gray-200" />
              </div>

              <div className="mt-8">
                <h3 className="text-xl font-medium text-gray-900">- What You’re Doing Well</h3>
                {doingWell.length ? (
                  <ul className="mt-4 list-disc list-inside space-y-2 text-base text-gray-600">
                    {doingWell.map((t, idx) => <li key={`dw-${idx}`}>{t}</li>)}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">No insights available.</p>
                )}
              </div>

              <div className="mt-10">
                <h3 className="text-xl font-medium text-gray-900">- Where Your Resume Falls Short</h3>
                {fallsShort.length ? (
                  <ul className="mt-4 list-disc list-inside space-y-2 text-base text-gray-600">
                    {fallsShort.map((t, idx) => <li key={`fs-${idx}`}>{t}</li>)}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">No gaps detected.</p>
                )}
              </div>
            </div>

            {/* Improvements */}

            <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="mt-12">
                <div className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    ✨
                  </span>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                      How to Improve Your Resume <span className="text-gray-400 font-medium"> · For this role</span>
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Actionable suggestions to increase your match score and resume strength.
                    </p>
                  </div>
                </div>
                <div className="mt-6 h-px w-full bg-gray-200" />
              </div>

              <div className="mt-8">
                <h3 className="text-xl font-medium text-gray-900">- Recommended Improvements</h3>
                {improvements.length ? (
                  <ul className="mt-4 list-disc list-inside space-y-2 text-base text-gray-600">
                    {improvements.map((t, idx) => <li key={`im-${idx}`}>{t}</li>)}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">No recommendations available.</p>
                )}
              </div>
            </div>

            <button
              onClick={handleDownloadPdf}
              className="group mt-8 inline-flex items-center gap-2 rounded-2xl border border-indigo-700 px-5 py-2.5 font-semibold text-indigo-900 hover:bg-indigo-50"
            >
              <Image
                src="/icons/download.png"
                alt="Download"
                width={18}
                height={18}
                className="transition-transform group-hover:translate-y-0.5"
              />
              <span>Download PDF Report</span>
            </button>
          </>
        )}
      </div>
    </main>
  );
}
