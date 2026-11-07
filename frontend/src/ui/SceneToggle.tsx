import { useCameraStatus } from '../renderer/camera/camera-status.js';
import './SceneToggle.css';

/** Q44: one button for the scene that is not on screen. "Solar System" flies to NASA's home view; "Earth" to the opening view. */
export function SceneToggle() {
  const scene = useCameraStatus((s) => s.scene);
  const requestHome = useCameraStatus((s) => s.requestHome);
  const requestEarth = useCameraStatus((s) => s.requestEarth);
  const atEarth = scene === 'earth';
  return (
    <button type="button" className="scene-toggle" onClick={atEarth ? requestHome : requestEarth}>
      {atEarth ? 'Solar System' : 'Earth'}
    </button>
  );
}
