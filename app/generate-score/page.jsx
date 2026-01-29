import Header from "../components/header";

export default function GenerateScore(){
  return(

    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
      <Header />
      <div className="rounded-xl bg-gray-200 px-6 py-6">
        <textarea className="text-sm text-gray-700 font-semibold">
          Generating Scores ......
        </textarea>
      </div>
      </div>

    </main>

  )
}