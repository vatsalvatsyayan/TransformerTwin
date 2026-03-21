// React Three Fiber Canvas + camera + lights

import { memo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { TransformerModel } from './TransformerModel'
import { StatusLegend } from './StatusLegend'
import { CameraResetButton } from './CameraResetButton'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'

export const TransformerScene = memo(function TransformerScene() {
  const controlsRef = useRef<OrbitControlsType>(null)

  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset()
    }
  }

  return (
    <div className="relative w-full h-full bg-[#0f1117]">
      <Canvas
        camera={{ position: [4, 3, 5], fov: 45, near: 0.1, far: 100 }}
        shadows
      >
        {/* Ambient + directional lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-5, 3, -5]} intensity={0.3} />

        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.7, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#1a1d27" />
        </mesh>

        <TransformerModel />

        <OrbitControls
          ref={controlsRef}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={20}
        />
      </Canvas>

      <StatusLegend />
      <CameraResetButton onReset={resetCamera} />
    </div>
  )
})
