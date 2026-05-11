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
              <td>Attack-move (move + auto-engage)</td>
            </tr>
            <tr>
              <td className="key">R-Click enemy</td>
              <td>Attack target</td>
            </tr>
            <tr>
              <td className="key">Mouse edges</td>
              <td>Pan camera (canvas edges)</td>
            </tr>
            <tr>
              <td className="key">M-Drag</td>
              <td>Pan camera</td>
            </tr>
            <tr>
              <td className="key">Alt + M-Drag</td>
              <td>Rotate camera (orbit)</td>
            </tr>
            <tr>
              <td className="key">Wheel</td>
              <td>Zoom (toward cursor on ground)</td>
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
              <td>Recall group, or roster slot if empty; double-tap centers camera</td>
            </tr>
            <tr>
              <td className="key">Ctrl + 1-9</td>
              <td>Assign control group</td>
            </tr>
            <tr>
              <td className="key">Tab</td>
              <td>Rotate primary in group, or cycle friendlies</td>
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
          Mobile: touch still works but is not optimized this version. Double-click &ldquo;select all same type&rdquo; is future work.
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
              <td className="key">R</td>
              <td>Return to tactical command</td>
            </tr>
            <tr>
              <td className="key">Esc</td>
              <td>Pause (Esc again to resume)</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
  return null;
};
