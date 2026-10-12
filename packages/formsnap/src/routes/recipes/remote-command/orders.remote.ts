import { command, query } from "$app/server";
import { listOrders, placeOrder } from "./orders.js";
import { orderSchema } from "./schema.js";

/**
 * The application-owned mutation. A command validates its input with the shared schema, runs on the
 * server, and hands back a result the caller has to interpret; there is no HTML form contract behind
 * it, which is why this recipe is JavaScript-dependent and has no no-JavaScript fallback.
 */
export const placeOrderCommand = command(orderSchema, (input) => placeOrder(input));

/** The list this page shows, so an explicit refresh can demonstrate that the mutation happened. */
export const placedOrders = query(() => listOrders());
