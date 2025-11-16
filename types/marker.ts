import { RoofType } from "./roof"

export interface MarkerTransform {
  id: string
  roofType: RoofType

  position: {
    x: number
    y: number
    z: number
  }
  rotationY: number

  scaleX: number
  scaleY: number

  widthMeters: number
  heightMeters: number

  isResizing: boolean
  isSelected: boolean
}
