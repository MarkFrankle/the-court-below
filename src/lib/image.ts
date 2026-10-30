const LONG_EDGE = 1080

// Shrinks a phone photo before upload: EXIF rotation applied, 1080 px on the long edge, JPEG at 0.8 (roughly 150–250 KB).
export async function toPortrait(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not read that photo.'))), 'image/jpeg', 0.8),
  )
}
