import type { MarkerTransform } from "@/types/marker"

type Listener = (markers: MarkerTransform[]) => void

let markers: MarkerTransform[] = []
const listeners = new Set<Listener>()

/**
 * Notifies all subscribed listeners with a snapshot of the current markers.
 * The snapshot is a shallow copy to prevent external mutations.
 */
function notify() {
  const snapshot = markers.map((marker) => ({ ...marker }))
  listeners.forEach((listener) => listener(snapshot))
}

/**
 * Subscribes a listener function to receive updates whenever markers change.
 * The listener is immediately called with the current markers state.
 *
 * @param listener - Callback function that receives an array of marker transforms
 * @returns Unsubscribe function to remove the listener
 */
export function subscribeMarkers(listener: Listener) {
  listeners.add(listener)
  listener(markers.map((marker) => ({ ...marker })))

  return () => {
    listeners.delete(listener)
  }
}

/**
 * Updates an existing marker or adds a new one if it doesn't exist.
 * Merges the provided marker data with existing data if the marker already exists.
 *
 * @param marker - The marker transform to update or add
 */
export function updateMarker(marker: MarkerTransform) {
  const index = markers.findIndex((marker) => marker.id === marker.id)
  if (index !== -1) {
    markers[index] = { ...marker, ...markers[index] }
  } else {
    markers.push(marker)
  }
  notify()
}

/**
 * Removes a marker by its ID and notifies all listeners.
 *
 * @param id - The unique identifier of the marker to remove
 */
export function removeMarker(id: string) {
  markers = markers.filter((marker) => marker.id !== id)
  notify()
}

/**
 * Clears all markers and notifies all listeners.
 */
export function clearMarkers() {
  markers = []
  notify()
}
