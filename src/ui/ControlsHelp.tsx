import React, { useState } from 'react';

interface Props {
  mode: 'tactical' | 'directControl' | 'paused' | 'menu' | 'briefing' | 'victory' | 'defeat';
}

const TACTICAL_ROWS: Array<[string, string]> = [
  ['L-Click', 'Select unit'],
  ['Shift + L-Click', 'Add / remove from selection'],
  ['L-Drag', 'Box select'],
  ['R-Click ground', 'Attack-move (move + auto-engage)'],
  ['R-Click enemy', 'Attack target'],
  ['Mouse edges', 'Pan camera (canvas edges)'],
  ['M-Drag', 'Pan camera'],
  ['Alt + M-Drag', 'Rotate camera (orbit)'],
  ['Wheel', 'Zoom (toward cursor on ground)'],
  ['WASD / Arrows', 'Pan camera'],
  ['Shift', 'Faster pan'],
  ['Q / E', 'Rotate camera'],
  ['R / Home', 'Reset camera'],
  ['F', 'Center on selected'],
  ['H', 'Stop / hold position (selected)'],
  ['1-9', 'Recall group, or roster slot; double-tap centers camera'],
  ['Ctrl + 1-9', 'Assign control group'],
  ['Tab', 'Rotate primary in group, or cycle friendlies'],
  ['Enter', 'Jump into selected'],
  ['Space', 'Pause / resume'],
  ['Esc', 'Clear selection / pause'],
];

const DC_ROWS: Array<[string, string]> = [
  ['W / S', 'Forward / Reverse'],
  ['A / D', 'Turn left / right'],
  ['L-Click', 'Fire cannon'],
  ['Space', 'Fire (backup)'],
  ['R', 'Return to tactical command'],
  ['Esc', 'Pause (Esc again to resume)'],
];

export const ControlsHelp: React.FC<Props> = ({ mode }) => {
  const [open, setOpen] = useState(false);

  if (mode !== 'tactical' && mode !== 'directControl') return null;
  const rows = mode === 'tactical' ? TACTICAL_ROWS : DC_ROWS;
  const title = mode === 'tactical' ? 'Tactical Controls' : 'Vehicle Controls';

  return (
    <div
      className={`controls-help game-ui-panel${open ? '' : ' collapsed'}`}
      data-ui-interactive="true"
    >
      <div className="controls-help-header">
        <h4>{open ? title : 'Controls'}</h4>
        <button
          type="button"
          className="controls-help-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={open ? 'Hide controls' : 'Show controls'}
        >
          {open ? '–' : '?'}
        </button>
      </div>
      {open && (
        <>
          <table>
            <tbody>
              {rows.map(([key, action]) => (
                <tr key={key}>
                  <td className="key">{key}</td>
                  <td>{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {mode === 'tactical' && (
            <div className="controls-help-footnote">
              Touch: drag battlefield to pan, pinch to zoom, tap unit / ground to command.
            </div>
          )}
        </>
      )}
    </div>
  );
};
