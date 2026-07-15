import { useState } from 'react';

/** Reusable drop-or-click file picker. */
export function FileDrop({
  accept,
  label,
  onPick,
}: {
  accept: string;
  label: string;
  onPick: (file: File | undefined) => void;
}): JSX.Element {
  const [drag, setDrag] = useState(false);
  return (
    <label
      className={`dropzone${drag ? ' dropzone--drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        onPick(e.dataTransfer.files[0]);
      }}
    >
      <input type="file" accept={accept} onChange={(e) => onPick(e.target.files?.[0])} hidden />
      <span>{label}</span>
    </label>
  );
}
