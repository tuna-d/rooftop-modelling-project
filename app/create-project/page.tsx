"use client"

import ModelCanvas from "@/canvases/ModelCanvas"
import PlanCanvas from "@/canvases/PlanCanvas"
import { NextPage } from "next"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useState } from "react"
import { AddRoofCommand, RoofType } from "@/types/roof"

function CreateProject() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const roofImageParam = searchParams.get("img") || "roof-1.png"
  const roofImage = `/images/${roofImageParam}`

  const [addCommand, setAddCommand] = useState<AddRoofCommand | null>(null)

  const issueAddRoof = (roofType: RoofType) => {
    setAddCommand({
      roofType,
      uniqeStamp: Date.now(),
    })
  }

  return (
    <div className="flex flex-col w-screen h-screen">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold"
        >
          ← Go Back
        </button>
        <h1 className="text-center flex-1 text-2xl">Rooftop Modeling Tool</h1>
        <div className="w-24" />
      </div>

      <div className="flex justify-center gap-2 my-4">
        <button
          onClick={() => issueAddRoof("flat")}
          className="px-3 py-1 rounded border bg-blue-500 hover:bg-blue-600 transition-colors min-w-48"
        >
          Add Flat Roof
        </button>

        <button
          onClick={() => issueAddRoof("dualPitch")}
          className="px-3 py-1 rounded border bg-blue-500 hover:bg-blue-600 transition-colors min-w-48"
        >
          Add Dual Pitch Roof
        </button>
      </div>

      <div className="flex h-full">
        <div className="h-full w-2/3 border">
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
            <PlanCanvas roofImage={roofImage} addCommand={addCommand} />
          </div>
        </div>

        <div className="w-1/3 ms-2 flex flex-col">
          <div className="flex-1 border flex items-center justify-center text-gray-500 text-sm">
            <ModelCanvas />
          </div>

          <div className="mt-4 border p-3 rounded h-1/3">
            <h2 className="font-bold mb-2">Roofs</h2>
            <div className="text-gray-500 text-sm">No roofs yet</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const Page: NextPage = () => {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          Loading...
        </div>
      }
    >
      <CreateProject />
    </Suspense>
  )
}

export default Page
