import Header from "../components/header";
import Image from "next/image";



export default function SuccessScore() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Header />

        <div className="rounded-lg bg-indigo-800 px-8 py-8 text-base font-semibold text-white">
          <p >
            Score generated successfully!
          </p>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Card 1 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Job Match Score:</h2>
              <p className="mt-2 text-sm text-gray-600">
                How well your resume matches this job description
              </p>
            </div>

            <div className="mt-10 flex items-center justify-center">
              <p className="text-7xl font-extrabold text-black">83</p>
            </div>
          </div>

          {/* Card 2 */}
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
              <p className="text-7xl font-extrabold text-black">58%</p>
            </div>
          </div>
        </div>

        {/* {AI Resume Insights} */}
        <div>
          <h1 className="text-3xl font-bold mt-8 tracking-wide">🔎AI Resume Insights</h1>


        </div>
      {/* {how to improve your resume for this role} */}
        <div>

        </div>

        <button className="group mt-8 inline-flex items-center gap-2 rounded-2xl border border-indigo-700 px-5 py-2.5 font-semibold text-indigo-900 hover:bg-indigo-50">
          <Image
            src="/icons/download.png"
            alt="Download"
            width={18}
            height={18}
            className="transition-transform group-hover:translate-y-0.5"
          />
          <span>Download Report</span>
        </button>

      </div>




    </main>
  );
}
