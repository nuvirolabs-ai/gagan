export type MiniCartSurface =
  | "Home"
  | "Products"
  | "ProductDetail"
  | "Cart"
  | "Review"
  | "Checkout"
  | "OrderDetail"
  | (string & {});

/** The catalogue subtotal affordance is intentionally absent from payment/order surfaces. */
export function shouldShowMiniCart(surface: MiniCartSurface): boolean {
  return surface === "Home" || surface === "Products" || surface === "ProductDetail";
}
