import Header from "../components/header";

export default function FailsScore(){
  return(
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
      <Header />
        <div className="rounded-xl bg-gray-200 px-8 py-8">
          <p className="text-base text-gray-700 font-semibold pb-2.5">
            ❌Score Generation Failed
          </p>
          <div className="text-sm text-gray-400 pl-2.5">
            <p>we couldn't analyze your resume at this time</p>
            <p>This could be due to a temporary issue or unsupported file content </p>
          </div>

          <div>
            <button className="border rounded-2xl bg-indigo-800 border-indigo-700 mt-8 p-2.5 text-white font-semibold mr-20 hover:bg-indigo-400">
            Try Again
          </button>

          <button className="border rounded-2xl border-indigo-700 mt-8 p-2.5 text-indigo-800 font-semibold">
            Edit Resume
          </button>

          </div>

        </div>
      </div>

    </main>
  )
}