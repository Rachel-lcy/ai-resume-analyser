import Image from "next/image";
import logo from "../public/icons/upload.png";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 flex items-center gap-4">
          <h1 className="text-5xl font-extrabold tracking-tight">
            AI Resume Analyzer
          </h1>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <p className="mb-4 text-gray-700">
            Upload your Resume/CV in PDF format
          </p>

          <div className="rounded-xl bg-gray-200 px-6 py-6">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-start gap-3">
                <Image src={logo} alt="upload logo" width={22} height={22} />

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Drag and Drop your file here
                  </h3>
                  <p className="text-xs text-gray-600">Limit 200MB per file</p>
                </div>
              </div>

              <button className="shrink-0 rounded-xl bg-gray-800 px-5 py-2 text-sm font-semibold text-white hover:bg-black">
                Browse Files
              </button>
            </div>
          </div>

          <div>
            <p className="mb-4 text-gray-700 mt-7">
              Enter the Job Description of the role you are applying for:
            </p>

            <div className="rounded-xl bg-gray-200 px-6 py-6">
              <textarea name="" id="" className="text-sm text-gray-500">
                Job Description
              </textarea>
            </div>
          </div>
          <button className="border rounded-2xl border-indigo-700 mt-8 p-2.5 text-indigo-900 font-semibold">
            Analyze
          </button>
        </section>
      </div>
    </main>
  );
}
