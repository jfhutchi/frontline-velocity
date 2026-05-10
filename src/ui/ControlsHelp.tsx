import React from 'react';

interface Props {
  mode: 'tactical' | 'directControl' | 'paused' | 'menu' | 'briefing' | 'victory' | 'defeat';
}

export const ControlsHelp: React.FC<Props> = ({ mode }) => {
  if (mode === 'tactical') {
    return (
      <div className="controls-help game-ui-panel" data-ui-interactive="true">
        <h4>Tactical Controls</h4>
        <table>
          <tbody>
            <tr>
              <td className="key">L-Click</td>
              <td>Select unit</td>
            </tr>
            <tr>
              <td className="key">Shift + L-Click</td>
              <td>Add / remove from selection</td>
            </tr>
            <tr>
              <td className="key">L-Drag</td>
              <td>Box select</td>
            </tr>
            <tr>
              <td className="key">R-Click ground</td>
              <td>Move / attack-move</td>
            </tr>
            <tr>
              <td className="key">R-Click enemy</td>
              <td>Attack target</td>
            </tr>
            <tr>
              <td className="key">Mouse edges</td>
              <td>Pan camera</td>
            </tr>
            <tr>
              <td className="key">M-Drag</td>
              <td>Pan camera</td>
            </tr>
            <tr>
              <td className="key">Wheel</td>
              <td>Zoom</td>
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
              <td className="key">Q / E</td>
              <td>Rotate camera</td>
            </tr>
            <tr>
              <td className="key">R / Home</td>
              <td>Reset camera</td>
            </tr>
            <tr>
              <td className="key">F</td>
              <td>Center on selected</td>
            </tr>
            <tr>
              <td className="key">1-9</td>
              <td>Select roster / recall group</td>
            </tr>
            <tr>
              <td className="key">Ctrl + 1-9</td>
              <td>Assign control group</td>
            </tr>
            <tr>
              <td className="key">Tab</td>
              <td>Cycle selection</td>
            </tr>
            <tr>
              <td className="key">Enter</td>
              <td>Jump into selected</td>
            </tr>
            <tr>
              <td className="key">Space</td>
              <td>Pause / resume</td>
            </tr>
            <tr>
              <td className="key">Esc</td>
              <td>Clear selection / pause</td>
            </tr>
          </tbody>
        </table>
        <div className="controls-help-footnote">
          Mobile controls are not optimized in v0.0.3.
        </div>
      </div>
    );
  }
  if (mode === 'directControl') {
    return (
      <div className="controls-help game-ui-panel" data-ui-interactive="true">
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
