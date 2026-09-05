/** Heart toggle used on every product card / detail page. */
import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { isWishlisted, toggleWishlist } from '../lib/wishlist';

interface Props {
  id: string;
  name: string;
  price: number;
  emoji?: string;
  className?: string;
}

export function WishHeart({ id, name, price, emoji, className = '' }: Props) {
  const [on, setOn] = useState(isWishlisted(id));

  useEffect(() => {
    const sync = () => setOn(isWishlisted(id));
    window.addEventListener('merchantos:wishlist', sync);
    return () => window.removeEventListener('merchantos:wishlist', sync);
  }, [id]);

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOn(toggleWishlist({ id, name, price, emoji: emoji || '📦' })); }}
      title={on ? 'Remove from wishlist' : 'Save to wishlist'}
      aria-label={on ? 'Remove from wishlist' : 'Save to wishlist'}
      className={className}
    >
      <Heart className={`w-4 h-4 transition-all ${on ? 'fill-red-500 text-red-500 scale-110' : 'text-muted-foreground'}`} />
    </button>
  );
}
