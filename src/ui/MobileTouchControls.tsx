import React, { useEffect, useRef, useState } from 'react';

interface Props {
  onInputChange: (forward: number, turn: number, fire: boolean) => void;
  onReturn: () => void;
  onFireDown: () => void;
}

export const MobileTouchControls: React.FC<Props> = ({ onInputChange, onReturn }) => {
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef<HTMLDivElement | null>(null);
  const [forward, setForward] = useState(0);
  const [turn, setTurn] = useState(0);
  const [fire, setFire] = useState(false);
  const trackingId = useRef<number | null>(null);

  useEffect(() => {
    onInputChange(forward, turn, fire);
  }, [forward, turn, fire, onInputChange]);

  const handleJoystickMove = (clientX: number, clientY: number) => {
    const j = joystickRef.current;
    if (!j) return;
    const rect = j.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const max = rect.width / 2 - 12;
    const len = Math.hypot(dx, dy);
    const nx = len > max ? (dx / len) * max : dx;
    const ny = len > max ? (dy / len) * max : dy;
    if (stickRef.current) {
      stickRef.current.style.transform = `translate(${nx}px, ${ny}px)`;
    }
    setForward(-ny / max);
    setTurn(nx / max);
  };

  const reset = () => {
    if (stickRef.current) {
      stickRef.current.style.transform = 'translate(0px, 0px)';
    }
    setForward(0);
    setTurn(0);
  };

  return (
    <div className="mobile-controls">
      <div
        className="joystick"
        ref={joystickRef}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          trackingId.current = e.pointerId;
          handleJoystickMove(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (trackingId.current !== e.pointerId) return;
          handleJoystickMove(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (trackingId.current === e.pointerId) {
            trackingId.current = null;
            reset();
          }
        }}
        onPointerCancel={() => {
          trackingId.current = null;
          reset();
        }}
      >
        <div className="stick" ref={stickRef} />
      </div>

      <button
        className="fire-btn"
        onPointerDown={() => setFire(true)}
        onPointerUp={() => setFire(false)}
        onPointerCancel={() => setFire(false)}
        onPointerLeave={() => setFire(false)}
      >
        FIRE
      </button>

      <button
        className="return-btn"
        onClick={() => onReturn()}
      >
        Return
      </button>
    </div>
  );
};
