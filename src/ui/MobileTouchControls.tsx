import React, { useRef } from 'react';

interface Props {
  onInputChange: (forward: number, turn: number, fire: boolean) => void;
  onReturn: () => void;
}

/**
 * Mobile direct-control HUD: virtual drive stick + fire / return buttons.
 *
 * Input is pushed to the engine *synchronously* from each pointer handler so
 * there is no dependency on React effect timing or callback identity. Pointer
 * capture is taken on currentTarget, and pointer defaults are prevented so the
 * browser does not synthesize a compatibility mouse-click (which the
 * direct-control input layer would otherwise read as a gun-fire).
 */
export const MobileTouchControls: React.FC<Props> = ({ onInputChange, onReturn }) => {
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef<HTMLDivElement | null>(null);
  const joyPointer = useRef<number | null>(null);

  // Latest input values; refs so push() always sends current state immediately.
  const forward = useRef(0);
  const turn = useRef(0);
  const fire = useRef(false);

  const push = () => onInputChange(forward.current, turn.current, fire.current);

  const moveStick = (clientX: number, clientY: number) => {
    const pad = joystickRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const max = Math.max(1, rect.width / 2 - 12);
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    if (stickRef.current) {
      stickRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    forward.current = -dy / max;
    turn.current = dx / max;
    push();
  };

  const releaseStick = () => {
    if (stickRef.current) {
      stickRef.current.style.transform = 'translate(0px, 0px)';
    }
    forward.current = 0;
    turn.current = 0;
    push();
  };

  return (
    <div className="mobile-controls" data-ui-interactive="true">
      <div
        className="joystick"
        ref={joystickRef}
        data-ui-interactive="true"
        aria-label="Drive stick"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          joyPointer.current = e.pointerId;
          moveStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (joyPointer.current !== e.pointerId) return;
          e.preventDefault();
          moveStick(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (joyPointer.current !== e.pointerId) return;
          e.preventDefault();
          e.currentTarget.releasePointerCapture?.(e.pointerId);
          joyPointer.current = null;
          releaseStick();
        }}
        onPointerCancel={(e) => {
          if (joyPointer.current !== e.pointerId) return;
          joyPointer.current = null;
          releaseStick();
        }}
        onLostPointerCapture={() => {
          if (joyPointer.current !== null) {
            joyPointer.current = null;
            releaseStick();
          }
        }}
      >
        <div className="stick" ref={stickRef} />
      </div>

      <button
        className="fire-btn"
        type="button"
        data-ui-interactive="true"
        onPointerDown={(e) => {
          e.preventDefault();
          fire.current = true;
          push();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          fire.current = false;
          push();
        }}
        onPointerCancel={() => {
          fire.current = false;
          push();
        }}
        onPointerLeave={() => {
          fire.current = false;
          push();
        }}
      >
        FIRE
      </button>

      <button
        className="return-btn"
        type="button"
        data-ui-interactive="true"
        onClick={() => onReturn()}
      >
        Return
      </button>
    </div>
  );
};
