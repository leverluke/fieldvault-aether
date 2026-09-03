/**
 * Stub for `@mediapipe/pose`.
 *
 * `@tensorflow-models/pose-detection` statically `import`s `{ Pose }` from
 * `@mediapipe/pose` at the top of its ESM bundle, only to support the optional
 * MediaPipe BlazePose runtime. This app only ever creates a MoveNet detector
 * (see `src/vision/pose.ts`), which is pure TensorFlow.js and never touches the
 * MediaPipe class.
 *
 * The real package ships a browser-global `<script>` (it assigns `self.Pose`)
 * with no module exports, so a bundler cannot resolve the named `Pose` import —
 * it fails dependency optimization outright. Aliasing the specifier to this
 * stub satisfies the import binding so the MoveNet path bundles and runs. If the
 * MediaPipe runtime were ever selected, construction would throw here instead of
 * silently mis-behaving.
 */
export class Pose {
  constructor() {
    throw new Error(
      "@mediapipe/pose is stubbed: this app uses the MoveNet pose runtime, not MediaPipe BlazePose.",
    );
  }
}

export default { Pose };
