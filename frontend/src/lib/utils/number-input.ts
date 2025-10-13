/**
 * Prevents number input value changes on mouse wheel scroll
 * and prevents page/container scrolling when focused on number inputs
 * @param e - The wheel event
 */
export const numberInputOnWheelPreventChange = (
  e: React.WheelEvent<HTMLInputElement>
) => {
  // Prevent the input value change
  e.currentTarget.blur();

  // Prevent the page/container scrolling
  e.stopPropagation();

  // Refocus immediately, on the next tick (after the current function is done)
  setTimeout(() => {
    e.currentTarget.focus();
  }, 0);
};
