import {
  ArcRotateCamera,
  CascadedShadowGenerator,
  Color3,
  Color4,
  ColorCurves,
  DirectionalLight,
  DynamicTexture,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import { TACTICAL_CAMERA_MAX_BETA, TACTICAL_CAMERA_MIN_BETA, TACTICAL_CAMERA_MAX_RADIUS, TACTICAL_CAMERA_MIN_RADIUS } from '../constants';

export interface BabylonContext {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  hemiLight: HemisphericLight;
  sunLight: DirectionalLight;
  shadowGenerator: CascadedShadowGenerator;
  glowLayer: GlowLayer;
  pipeline: DefaultRenderingPipeline;
}

export function createBabylonContext(canvas: HTMLCanvasElement): BabylonContext {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    antialias: true,
    adaptToDeviceRatio: true,
  });
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const ratio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  engine.setHardwareScalingLevel(isTouchDevice && ratio > 1 ? Math.min(1.6, Math.max(1, ratio / 1.45)) : 1);

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.60, 0.72, 0.84, 1);
  scene.ambientColor = new Color3(0.20, 0.20, 0.16);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.75, 0.86, 0.92);
  scene.fogStart = 520;
  scene.fogEnd = 1600;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.05;
  scene.imageProcessingConfiguration.contrast = 1.26;
  scene.imageProcessingConfiguration.vignetteEnabled = true;
  scene.imageProcessingConfiguration.vignetteWeight = 0.34;
  scene.imageProcessingConfiguration.vignetteColor = new Color4(0.05, 0.045, 0.036, 1);

  // Warm Normandy color grading: lifted shadows, warm midtones, slightly desaturated greens
  const curves = new ColorCurves();
  curves.globalSaturation = 88;
  curves.shadowsExposure = 0.08;   // lift shadows — Generals-era RTS look
  curves.shadowsHue = 210;         // cool shadows
  curves.highlightsHue = 30;       // warm highlights
  curves.highlightsExposure = -0.04;
  scene.imageProcessingConfiguration.colorCurvesEnabled = true;
  scene.imageProcessingConfiguration.colorCurves = curves;

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
  hemiLight.groundColor = new Color3(0.22, 0.17, 0.11);

  const sunLight = new DirectionalLight('sun', new Vector3(-0.46, -0.78, -0.26), scene);
  sunLight.intensity = 1.68;
  sunLight.position = new Vector3(92, 112, 72);
  sunLight.shadowMinZ = 20;
  sunLight.shadowMaxZ = 220;

  // CascadedShadowGenerator — better depth split across the tactical view distance
  const shadowGenerator = new CascadedShadowGenerator(1024, sunLight);
  shadowGenerator.numCascades = 4;
  shadowGenerator.stabilizeCascades = true;
  shadowGenerator.lambda = 0.5;
  shadowGenerator.shadowMaxZ = 220;
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 22;
  shadowGenerator.setDarkness(0.28);

  // IBL: Babylon's built-in .env gives PBR materials something to reflect
  scene.createDefaultEnvironment({ createSkybox: false, createGround: false });
  scene.environmentIntensity = 0.65;

  const glowLayer = new GlowLayer('battlefield-glow', scene, { blurKernelSize: 32 });
  glowLayer.intensity = 0.16;

  const pipeline = new DefaultRenderingPipeline('battlefield-pipeline', true, scene, [camera]);
  pipeline.samples = isTouchDevice ? 1 : 4;
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.62;
  pipeline.bloomWeight = 0.16;
  pipeline.bloomKernel = 48;
  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = 0.18;
  pipeline.sharpen.colorAmount = 0.55;

  // SSAO2 — contact shadows on terrain and vehicles; skip on touch (perf)
  if (!isTouchDevice) {
    const ssao = new SSAO2RenderingPipeline('ssao', scene, { ssaoRatio: 0.5, blurRatio: 1 }, [camera]);
    ssao.radius = 2.5;
    ssao.totalStrength = 1.2;
    ssao.base = 0.3;
  }

  buildSkyDome(scene);
  buildCloudBanks(scene);

  return { engine, scene, camera, hemiLight, sunLight, shadowGenerator, glowLayer, pipeline };
}

export function disposeBabylonContext(ctx: BabylonContext) {
  ctx.scene.dispose();
  ctx.engine.dispose();
}

function buildSkyDome(scene: Scene) {
  const skyTexture = new DynamicTexture('proceduralSky', { width: 1024, height: 512 }, scene, true);
  const ctx = skyTexture.getContext() as CanvasRenderingContext2D;
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#b8d8f8');
  gradient.addColorStop(0.42, '#dceef4');
  gradient.addColorStop(1, '#e0bf82');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);

  for (let i = 0; i < 34; i += 1) {
    const x = seeded(i * 19 + 7) * 1024;
    const y = 34 + seeded(i * 23 + 2) * 165;
    const w = 70 + seeded(i * 29 + 4) * 160;
    const h = 18 + seeded(i * 31 + 5) * 48;
    const alpha = 0.18 + seeded(i * 37 + 9) * 0.2;
    const cloudGradient = ctx.createRadialGradient(x, y, 2, x, y, w);
    cloudGradient.addColorStop(0, `rgba(255,255,244,${alpha})`);
    cloudGradient.addColorStop(0.5, `rgba(244,238,220,${alpha * 0.62})`);
    cloudGradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cloudGradient;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, seeded(i * 41 + 3) * 0.4 - 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  skyTexture.update();

  const sky = MeshBuilder.CreateSphere('skyDome', {
    diameter: 560,
    segments: 32,
    sideOrientation: Mesh.BACKSIDE,
  }, scene);
  sky.infiniteDistance = true;
  sky.applyFog = false;
  sky.position.y = -24;
  const skyMat = new StandardMaterial('skyDomeMat', scene);
  skyMat.disableLighting = true;
  skyMat.backFaceCulling = false;
  skyMat.diffuseTexture = skyTexture;
  skyMat.emissiveTexture = skyTexture;
  skyMat.specularColor = Color3.Black();
  sky.material = skyMat;
}

function buildCloudBanks(scene: Scene) {
  const banks = [
    { x: -74, y: 52, z: -174, w: 116, h: 34 },
    { x: 16, y: 66, z: -198, w: 150, h: 42 },
    { x: 98, y: 52, z: -146, w: 96, h: 30 },
    { x: -128, y: 48, z: -122, w: 88, h: 26 },
    { x: 42, y: 66, z: 150, w: 104, h: 30 },
  ];

  banks.forEach((bank, bankIndex) => {
    const tex = new DynamicTexture(`cloudTex_${bankIndex}`, { width: 512, height: 192 }, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 512, 192);
    for (let i = 0; i < 11; i += 1) {
      const x = 40 + seeded(bankIndex * 31 + i * 7) * 432;
      const y = 70 + seeded(bankIndex * 37 + i * 11) * 48;
      const rx = 46 + seeded(bankIndex * 41 + i * 13) * 74;
      const ry = 16 + seeded(bankIndex * 43 + i * 17) * 26;
      const alpha = 0.16 + seeded(bankIndex * 47 + i * 19) * 0.2;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, rx);
      grad.addColorStop(0, `rgba(246,244,226,${alpha})`);
      grad.addColorStop(0.55, `rgba(228,226,208,${alpha * 0.58})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    tex.update();
    tex.hasAlpha = true;

    const mat = new StandardMaterial(`cloudMat_${bankIndex}`, scene);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.diffuseTexture = tex;
    mat.opacityTexture = tex;
    mat.emissiveTexture = tex;
    mat.specularColor = Color3.Black();
    mat.useAlphaFromDiffuseTexture = true;

    const cloud = MeshBuilder.CreatePlane(`cloud_bank_${bankIndex}`, { width: bank.w, height: bank.h }, scene);
    cloud.position = new Vector3(bank.x, bank.y, bank.z);
    cloud.billboardMode = Mesh.BILLBOARDMODE_ALL;
    cloud.material = mat;
    cloud.applyFog = false;
    cloud.isPickable = false;
  });
}

function seeded(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
