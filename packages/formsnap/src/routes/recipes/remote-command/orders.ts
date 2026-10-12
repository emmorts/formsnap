import type { OrderData } from "./schema.js";

/**
 * The application's own data, and the only place this recipe mutates anything. Nothing here knows
 * about Superforms or remote functions: the command is a transport in front of `placeOrder`, and the
 * receipt route reads the same store through its own load.
 *
 * The domain is here rather than in the form, which is the point of the recipe: the plan limits are
 * the business's, not the client's, and a refusal is a result the caller has to translate.
 */

export type PlacedOrder = { id: string; plan: string; seats: number; note: string };

/** What the caller has to handle: an accepted order, or a refusal it has to present. */
export type PlaceOrderResult =
	| { status: "accepted"; order: PlacedOrder }
	| { status: "rejected"; field?: keyof OrderData; message: string };

const PLAN_LIMITS: Record<string, number> = { starter: 5, pro: 25 };

/**
 * Stands in for the account this request acts for. Authorisation belongs to the server: the form
 * offers both plans, and this decides which one the account may actually have.
 */
const ACCOUNT_PLAN = "starter";

const placed = new Map<string, PlacedOrder>();
let counter = 0;

export function placeOrder(input: OrderData): PlaceOrderResult {
	// Stands in for a downstream service that is unavailable. The recipe uses it to show what an
	// unexpected failure does to a submission.
	if (input.note === "unreachable") {
		throw new Error("The order ledger is unreachable.");
	}

	// Authorisation, not validation: the input is well formed, and the account is still not entitled
	// to what it asked for. The refusal names the control the user has to change.
	if (input.plan !== ACCOUNT_PLAN) {
		return {
			status: "rejected",
			field: "plan",
			message: `This account is on the ${ACCOUNT_PLAN} plan.`,
		};
	}

	const limit = PLAN_LIMITS[input.plan] ?? 0;
	if (input.seats > limit) {
		return {
			status: "rejected",
			field: "seats",
			message: `The ${input.plan} plan allows at most ${limit} seats.`,
		};
	}

	const previous = [...placed.values()].at(-1);
	if (
		previous &&
		previous.plan === input.plan &&
		previous.seats === input.seats &&
		previous.note === input.note
	) {
		// A refusal that belongs to no single control: nothing in the form needs correcting.
		return {
			status: "rejected",
			message: "That order was just placed. Change something first.",
		};
	}

	const order = {
		id: `order-${++counter}`,
		plan: input.plan,
		seats: input.seats,
		note: input.note,
	};
	placed.set(order.id, order);
	return { status: "accepted", order };
}

export function listOrders() {
	return [...placed.values()];
}

export function findOrder(id: string) {
	return placed.get(id) ?? null;
}
