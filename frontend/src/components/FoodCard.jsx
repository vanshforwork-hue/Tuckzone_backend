import React from 'react';
import { Plus, BadgeCheck } from 'lucide-react';
import QuantityInput from './QuantityInput';
import './FoodCard.css';

/** One row in a menu list — square image, name/description, price + add control.
 *  Mirrors the reference "Today's Menu" row layout; used by MenuPage and the cart drawer. */
export default function FoodCard({
  name,
  description,
  imageUrl,
  price,
  stockLabel,
  soldOut,
  soldOutLabel,
  quantity = 0,
  incrementDisabled,
  onAdd,
  onIncrement,
  onDecrement,
  onChangeQuantity,
}) {
  return (
    <div className={`tz-food-card ${soldOut ? 'sold-out' : ''}`}>
      <div className="tz-food-thumb">
        {imageUrl ? (
          <img src={imageUrl} alt={name} loading="lazy" />
        ) : (
          <div className="tz-food-thumb-fallback">{name.charAt(0)}</div>
        )}
        {soldOut && <div className="tz-food-soldout-badge">{soldOutLabel}</div>}
      </div>

      <div className="tz-food-info">
        <div className="tz-food-name-row">
          <BadgeCheck size={15} className="tz-food-veg-icon" />
          <h3>{name}</h3>
        </div>
        {description && <p className="tz-food-desc">{description}</p>}
        {stockLabel && <span className="tz-food-stock">{stockLabel}</span>}
      </div>

      <div className="tz-food-action">
        <span className="tz-food-price">₹{price}</span>
        {quantity > 0 ? (
          <QuantityInput
            small
            quantity={quantity}
            onDecrement={onDecrement}
            onIncrement={onIncrement}
            onChange={onChangeQuantity}
            incrementDisabled={incrementDisabled}
          />
        ) : (
          <button
            type="button"
            className="tz-food-add-btn"
            disabled={soldOut}
            onClick={onAdd}
            aria-label={`Add ${name}`}
          >
            <Plus size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
