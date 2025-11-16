"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

const roofImages = [
  { id: 1, name: "roof-1.png", path: "/images/roof-1.png" },
  { id: 2, name: "roof-2.png", path: "/images/roof-2.png" },
  { id: 3, name: "roof-3.png", path: "/images/roof-3.png" },
  { id: 4, name: "roof-4.png", path: "/images/roof-4.png" },
]
export default function Home() {
  const [selectedRoofImg, setSelectedRoofImg] = useState<string>(
    roofImages[0].path
  )
  const router = useRouter()

  const handleCreateProject = () => {
    const imgName = selectedRoofImg.split("/").pop() || "roof-1.png"
    router.push(`/create-project?img=${imgName}`)
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Select Roof Image</h1>

      <div className="flex gap-4 mb-6">
        {roofImages.map((roof) => (
          <div
            key={roof.id}
            onClick={() => setSelectedRoofImg(roof.path)}
            className={`cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
              selectedRoofImg === roof.path
                ? "border-blue-500 shadow-lg scale-105"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <div className="w-32 h-32 relative">
              <Image
                src={roof.path}
                alt={roof.name}
                fill
                className="object-cover"
                sizes="128px"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleCreateProject}
        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
      >
        Create Project
      </button>
    </div>
  )
}
