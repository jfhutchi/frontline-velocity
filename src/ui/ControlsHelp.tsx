import React from 'react';

interface Props {
  mode: 'tactical' | 'directControl' | 'paused' | 'menu' | 'briefing' | 'victory' | 'defeat';
}

export const ControlsHelp: React.FC<Props> = ({ mode }) => {
  if (mode === 'tactical') {
    return (
      <div className="controls-help">
        <h4>Controls</h4>
        <table>
          <tbody>
            <tr>
              <td className="key">L-Click</td>
              <td>Select friendly unit</td>
            </tr>
            <tr>
              <td className="key">R-Click</td>
              <td>Issue move order</td>
            </tr>
            <tr>
              <td className="key">1-4 / Tab</td>
              <td>Select units</td>
            </tr>
            <tr>
              <td className="key">F / Enter</td>
              <td>Jump into vehicle</td>
            </tr>
            <tr>
              <td className="key">WASD / Arrows</td>
              <td>Pan camera</td>
            </tr>
            <tr>
              <td className="key">Shift</td>
              <td>Faster pan</td>
            </tr>
            <tr>
              <td className="key">Wheel</td>
              <td>Zoom camera</td>
            </tr>
            <tr>
              <td className="key">Q / E</td>
              <td>Rotate camera</td>
            </tr>
            <tr>
              <td className="key">M-Drag</td>
              <td>Pan camera</td>
            </tr>
            <tr>
              <td className="key">R / Home</td>
              <td>Reset camera</td>
            </tr>
            <tr>
              <td className="key">Touch</td>
              <td>Tap select/order, two-finger pan/pinch</td>
            </tr>
            <tr>
              <td className="key">Esc / Space</td>
              <td>Pause</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
  if (mode === 'directControl') {
    return (
      <div className="controls-help">
        <h4>Vehicle Controls</h4>
        <table>
          <tbody>
            <tr>
              <td className="key">W / S</td>
              <td>Forward / Reverse</td>
            </tr>
            <tr>
              <td className="key">A / D</td>
              <td>Turn left / right</td>
            </tr>
            <tr>
              <td className="key">L-Click</td>
              <td>Fire cannon</td>
            </tr>
            <tr>
              <td className="key">Space</td>
              <td>Fire (backup)</td>
            </tr>
            <tr>
              <td className="key">R / Esc</td>
              <td>Return to command</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
  return null;
};
