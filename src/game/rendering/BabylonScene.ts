import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Scene,
  ShadowGenerator,
  Vector3,
} from '@babylonjs/core';
import { TACTICAL_CAMERA_MAX_BETA, TACTICAL_CAMERA_MIN_BETA, TACTICAL_CAMERA_MAX_RADIUS, TACTICAL_CAMERA_MIN_RADIUS } from '../constants';

export interface BabylonContext {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  hemiLight: HemisphericLight;
  sunLight: DirectionalLight;
  shadowGenerator: ShadowGenerator;
}

export function createBabylonContext(canvas: HTMLCanvasElement): BabylonContext {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: false,
    antialias: true,
    adaptToDeviceRatio: true,
  });
  engine.setHardwareScalingLevel(1);

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.04, 0.07, 0.05, 1);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.07, 0.1, 0.08);
  scene.fogStart = 120;
  scene.fogEnd = 260;

  const camera = new ArcRotateCamera(
    'tactical-cam',
    Math.PI * 0.5,
    Math.PI * 0.34,
    140,
    Vector3.Zero(),
    scene,
  );
  camera.lowerBetaLimit = TACTICAL_CAMERA_MIN_BETA;
  camera.upperBetaLimit = TACTICAL_CAMERA_MAX_BETA;
  camera.lowerRadiusLimit = TACTICAL_CAMERA_MIN_RADIUS;
  camera.upperRadiusLimit = TACTICAL_CAMERA_MAX_RADIUS;
  camera.minZ = 0.5;
  camera.maxZ = 600;
  camera.wheelDeltaPercentage = 0.04;
  camera.panningSensibility = 50;

  // Don't auto-attach inputs; CameraController owns input wiring per mode.
  const hemiLight = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene);
  hemiLight.intensity = 0.68;
  hemiLight.groundColor = new Color3(0.13, 0.16, 0.11);

  const sunLight = new DirectionalLight('sun', new Vector3(-0.55, -1, -0.35), scene);
  sunLight.intensity = 1.25;
  sunLight.position = new Vector3(65, 95, 48);
  const shadowGenerator = new ShadowGenerator(1024, sunLight);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 18;
  shadowGenerator.setDarkness(0.35);

  return { engine, scene, camera, hemiLight, sunLight, shadowGenerator };
}

export function disposeBabylonContext(ctx: BabylonContext) {
  ctx.scene.dispose();
  ctx.engine.dispose();
}
