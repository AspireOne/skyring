import { DEFAULT_GAME_CONFIG } from '@skyring/shared';
import * as THREE from 'three';

import { queueRequestFromLocation, serverWsUrl } from './config.js';
import { NetClient } from './net/net-client.js';

import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.dataset.simHz = String(DEFAULT_GAME_CONFIG.SIM_HZ);
app.dataset.renderStatus = 'starting';
app.dataset.netPhase = 'connecting';

startRenderSmokeScene(app);
startNetworking(app);

/**
 * Placeholder render scene (a spinning cube) proving the WebGL pipe is alive.
 * Milestone 3 replaces it with the flyable plane and arena.
 */
function startRenderSmokeScene(root: HTMLDivElement): void {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07111f);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.set(0, 1.5, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.domElement.dataset.testid = 'scene-canvas';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  root.append(renderer.domElement);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ color: 0x4cc9a7 }),
  );
  scene.add(cube);

  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(2, 3, 4);
  scene.add(light, new THREE.AmbientLight(0x6688aa, 0.8));

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let firstFrameRendered = false;
  renderer.setAnimationLoop((time) => {
    cube.rotation.x = time * 0.0004;
    cube.rotation.y = time * 0.0007;
    renderer.render(scene, camera);
    if (!firstFrameRendered) {
      firstFrameRendered = true;
      root.dataset.renderStatus = 'ready';
    }
  });
}

/** Connects to the server, enters matchmaking, and surfaces status. */
function startNetworking(root: HTMLDivElement): void {
  const status = document.createElement('div');
  status.dataset.testid = 'net-status';
  status.className = 'net-status';
  root.append(status);

  const net = new NetClient(
    serverWsUrl(),
    queueRequestFromLocation(window.location.search),
  );
  net.onUpdate = () => {
    root.dataset.netPhase = net.phase;
    const slot = net.slot ? ` · you are ${net.slot.toUpperCase()}` : '';
    status.textContent = `${describePhase(net.phase)}${slot}`;
  };
  net.onUpdate();
  net.connect();
  window.addEventListener('beforeunload', () => net.dispose());
}

function describePhase(phase: NetClient['phase']): string {
  switch (phase) {
    case 'connecting':
      return 'Connecting…';
    case 'connected':
      return 'Connected — finding a match…';
    case 'queued':
      return 'Waiting for an opponent…';
    case 'matched':
      return 'Match found!';
    case 'ended':
      return 'Match over';
    case 'rejected':
      return 'Server rejected the connection';
    case 'closed':
      return 'Disconnected';
  }
}
