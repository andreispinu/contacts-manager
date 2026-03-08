const LABELS = { 1: 'Acquaintance', 2: 'Casual', 3: 'Friend', 4: 'Close', 5: 'Inner Circle' };

export default function StarRating({ value = 3, onChange, size = 'md', showLabel = false }) {
  const starSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          className={`${starSize} leading-none transition-transform ${onChange ? 'cursor-pointer hover:scale-125' : 'cursor-default'} ${
            star <= value ? 'text-amber-400' : 'text-gray-200'
          }`}
          title={LABELS[star]}
        >
          ★
        </button>
      ))}
      {showLabel && (
        <span className="ml-1 text-sm text-gray-500">{LABELS[value] || ''}</span>
      )}
    </div>
  );
}
