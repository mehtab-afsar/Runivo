import { useEffect, useRef } from 'react'
import Globe from 'globe.gl'

interface Territory {
  lat: number
  lng: number
  name: string
  claimed: boolean
}

interface GlobeGLProps {
  territories?: Territory[]
  onCountryClick?: (country: string) => void
}

export const GlobeGL = ({ territories = [], onCountryClick }: GlobeGLProps) => {
  const globeRef = useRef<HTMLDivElement>(null)
  const globeInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (!globeRef.current) return

    // Initialize globe
    const globe = Globe()
      (globeRef.current)
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundColor('rgba(0,0,0,1)')
      .showAtmosphere(true)
      .atmosphereColor('lightskyblue')
      .atmosphereAltitude(0.15)
      .width(globeRef.current.clientWidth)
      .height(globeRef.current.clientHeight)

    // Enable controls
    globe.controls().autoRotate = true
    globe.controls().autoRotateSpeed = 0.5
    globe.controls().enableZoom = true
    globe.controls().minDistance = 200
    globe.controls().maxDistance = 600

    // Add user location marker
    if (territories.length > 0) {
      globe.pointsData(territories)
        .pointAltitude(0.05)
        .pointRadius(1.5)
        .pointColor('#10b981')
        .pointLabel((d: any) => d.name)
        .onPointClick((point: any) => {
          if (onCountryClick) {
            onCountryClick(point.name)
          }
        })
    }

    globeInstanceRef.current = globe

    // Handle resize
    const handleResize = () => {
      if (globeRef.current && globeInstanceRef.current) {
        globeInstanceRef.current
          .width(globeRef.current.clientWidth)
          .height(globeRef.current.clientHeight)
      }
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      if (globeInstanceRef.current) {
        // Clean up globe instance
        const scene = globeInstanceRef.current.scene()
        if (scene) {
          scene.children.forEach((child: any) => {
            if (child.geometry) child.geometry.dispose()
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: any) => mat.dispose())
              } else {
                child.material.dispose()
              }
            }
          })
        }
      }
    }
  }, [territories, onCountryClick])

  return (
    <div className="w-full h-full relative">
      <div ref={globeRef} className="w-full h-full" />

      {/* Instruction overlay */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <p className="text-sm font-light text-white/70 bg-black/20 backdrop-blur-sm px-4 py-2 rounded-full">
          Drag to rotate • Scroll to zoom • Click territories
        </p>
      </div>
    </div>
  )
}
