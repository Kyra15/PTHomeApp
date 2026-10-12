const PALETTE = ['#0B3D42', '#FF6B4A', '#1E8E4F', '#C87F1E', '#2163AF', '#8B5CF6'];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name }: { name: string }) {
  return (
    <div className="avatar" style={{ background: colorFor(name) }}>
      {initialsFor(name)}
    </div>
  );
}
