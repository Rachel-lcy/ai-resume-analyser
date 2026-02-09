"use client";

export default function Header({ meta }) {
  return (
    <div className="mb-8">
      <div className="flex items-end gap-4">
        <h1 className="text-5xl font-extrabold tracking-tight">
          AI Resume Analyzer
        </h1>
          {/* <p className="mt-2 text-xs text-gray-400">
            AI powered by Claude 3 Haiku (AWS Bedrock)
          </p> */}

        {/* AI 状态标签 */}
        {meta?.aiStatus === "ok" && (
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            AI powered by Claude 3 Haiku (AWS Bedrock)
          </span>
        )}

        {meta?.aiStatus === "failed" && (
          <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-700">
            AI unavailable · Rule-based analysis only
          </span>
        )}
      </div>

      {/* 可选：补充说明行 */}
      {meta?.aiStatus === "ok" && (
        <p className="mt-2 text-xs text-gray-400">
          Real-time AI insights generated using Amazon Bedrock!
        </p>
      )}

      {meta?.aiStatus === "failed" && (
        <p className="mt-2 text-xs text-gray-400">
          AI service temporarily unavailable. Displaying deterministic results.
        </p>
      )}
    </div>
  );
}
