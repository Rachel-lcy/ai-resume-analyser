import Header from "../components/header";

export default function GenerateScore(){
  return(

    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
      <Header />
      <div className="rounded-xl bg-gray-200 px-6 py-6">
        <p
              className="
                w-full
                h-10
                bg-transparent
                text-sm
                text-gray-500
                placeholder-gray-500
                outline-none
                resize-none
              ">Generating Scores ......
              </p>

      </div>
      </div>

    </main>

  )
}