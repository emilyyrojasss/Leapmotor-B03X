// Quita el fondo de una foto (Vision de macOS 14+). Con un 3er argumento guarda también la máscara.
// Compilar: swiftc -O tools/cutout.swift -o tools/cutout
// Usar:     tools/cutout foto.webp recorte.png mascara.png

import Foundation
import Vision
import CoreImage
import AppKit

// usage: swift cutout.swift <input> <output.png>
let args = CommandLine.arguments
let input = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2])

guard let ci = CIImage(contentsOf: input) else { fatalError("cannot read \(input.path)") }
let handler = VNImageRequestHandler(ciImage: ci)
let req = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([req])
guard let obs = req.results?.first else { fatalError("no subject in \(input.path)") }

// keep only the largest instance (the car)
var best = obs.allInstances.first!
var bestArea = 0
for inst in obs.allInstances {
    let m = try obs.generateScaledMaskForImage(forInstances: [inst], from: handler)
    let w = CVPixelBufferGetWidth(m), h = CVPixelBufferGetHeight(m)
    CVPixelBufferLockBaseAddress(m, .readOnly)
    let base = CVPixelBufferGetBaseAddress(m)!.assumingMemoryBound(to: Float32.self)
    let stride = CVPixelBufferGetBytesPerRow(m) / 4
    var area = 0
    for y in Swift.stride(from: 0, to: h, by: 8) { for x in Swift.stride(from: 0, to: w, by: 8) where base[y*stride+x] > 0.5 { area += 1 } }
    CVPixelBufferUnlockBaseAddress(m, .readOnly)
    if area > bestArea { bestArea = area; best = inst }
}
let mask = try obs.generateScaledMaskForImage(forInstances: [best], from: handler)
let maskImg = CIImage(cvPixelBuffer: mask)
let out = ci.applyingFilter("CIBlendWithMask", parameters: [
    kCIInputBackgroundImageKey: CIImage.empty(),
    kCIInputMaskImageKey: maskImg])
let ctx = CIContext()
if args.count > 3 {
    // máscara suave en escala de grises, misma resolución que la foto
    try ctx.writePNGRepresentation(of: maskImg, to: URL(fileURLWithPath: args[3]), format: .L8, colorSpace: CGColorSpaceCreateDeviceGray())
}
try ctx.writePNGRepresentation(of: out, to: output, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
print("ok \(output.lastPathComponent) instances=\(obs.allInstances.count)")
