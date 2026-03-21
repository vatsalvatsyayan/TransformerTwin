// React Three Fiber Canvas + camera + lights — bright outdoor industrial setting

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
    <div className="relative w-full h-full bg-[#c4d4db]">
      <Canvas
        camera={{ position: [4, 3, 5], fov: 45, near: 0.1, far: 100 }}
        shadows
        gl={{ antialias: true }}
      >
        {/* Sky background colour */}
        <color attach="background" args={['#c4d4db']} />

        {/* Hemisphere light — sky blue above, warm concrete below */}
        <hemisphereLight args={['#dbeafe', '#a8a090', 1.2]} />

        {/* Primary sun-like directional light from upper-right */}
        <directionalLight
          position={[6, 10, 6]}
          intensity={2.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.5}
          shadow-camera-far={50}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />

        {/* Fill light from opposite side — reduces harsh shadows */}
        <directionalLight position={[-5, 4, -4]} intensity={1.2} />

        {/* Front fill to illuminate the face of the transformer */}
        <directionalLight position={[0, 2, 8]} intensity={0.8} />

        {/* Concrete ground pad */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.75, 0]} receiveShadow>
          <planeGeometry args={[24, 24]} />
          <meshStandardMaterial color="#8f8f87" roughness={0.95} metalness={0} />
        </mesh>

        {/* Darker concrete pad directly under the transformer */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.74, 0]} receiveShadow>
          <planeGeometry args={[3.5, 2.2]} />
          <meshStandardMaterial color="#7a7a72" roughness={0.98} metalness={0} />
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
