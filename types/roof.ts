export type RoofType = "flat" | "dualPitch"

export type AddRoofCommand = {
  roofType: RoofType
  uniqeStamp: number
}
