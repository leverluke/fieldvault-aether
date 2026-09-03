/**
 * Stub for `@tensorflow/tfjs-backend-webgpu`.
 *
 * `@tensorflow-models/pose-detection` statically imports `{ WebGPUBackend,
 * webgpu_util }` from this package at the top of its ESM bundle, but the app
 * only ships the CPU and WebGL backends (via `@tensorflow/tfjs`) and never
 * registers or selects the WebGPU backend. The real package is not installed,
 * so Vite's dependency optimizer fails to resolve the import and the Aether
 * Eyes page cannot load pose detection.
 *
 * These bindings are referenced only inside pose-detection's WebGPU-specific
 * code paths — `WebGPUBackend` in `instanceof` checks (always false here) and
 * `webgpu_util` helpers in WebGPU kernels that never run. Providing inert
 * exports satisfies the import so the MoveNet path bundles and runs, without
 * pulling the large WebGPU backend the app does not use.
 */
export class WebGPUBackend {}

export const webgpu_util = {
  computeDispatch() {
    throw new Error("tfjs-backend-webgpu is stubbed: the WebGPU backend is not used by this app.");
  },
  flatDispatchLayout() {
    throw new Error("tfjs-backend-webgpu is stubbed: the WebGPU backend is not used by this app.");
  },
};

export default { WebGPUBackend, webgpu_util };
