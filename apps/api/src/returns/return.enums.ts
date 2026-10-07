export enum ReturnStatus {
  PENDING_INSPECT = 'pending_inspect',
  INSPECTED = 'inspected',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

/** Max days after delivery to open a return (matches /returns 7–14 day window). */
export const RETURN_WINDOW_DAYS = 14;
