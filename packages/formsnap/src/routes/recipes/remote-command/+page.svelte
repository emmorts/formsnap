<script lang="ts">
	import type { ActionResult } from "$app/forms";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { onMount, untrack } from "svelte";
	import { get } from "svelte/store";
	import { superForm, type SuperValidated } from "sveltekit-superforms";
	import { zodClient } from "sveltekit-superforms/adapters";
	import { Control, Field, Label } from "$lib/index.js";
	import type { PlacedOrder } from "./orders.js";
	import { placedOrders, placeOrderCommand } from "./orders.remote.js";
	import { orderSchema, type OrderData } from "./schema.js";

	let { data }: { data: { form: SuperValidated<OrderData> } } = $props();

	// Superforms owns submission; customRequest translates the remote command's result.
	const form = superForm(
		untrack(() => data.form),
		{
			// There is no action endpoint, so nothing applies page data back into the stores and nothing
			// tells Kit to reload the page's data: the translated result is what updates them, and the
			// recipe refreshes the query it shows instead of asking Kit to reload everything.
			applyAction: false,
			invalidateAll: false,
			// The client pass validates the same schema the command does, so the command normally only
			// sees input the browser already accepted. The server stays the authority either way.
			validators: zodClient(orderSchema),
			resetForm: true,
			onError: () => {
				// Superforms' default `onError` throws, and a throw from there aborts the submission before
				// its pending state is finalised, which would leave the form permanently busy. Recording
				// the failure keeps it usable.
				commandFailure = "The order service refused the request. Nothing was placed.";
			},
			onSubmit: ({ customRequest }) => {
				commandFailure = "";
				refreshFailure = "";
				// The command replaces the request Superforms would otherwise make. The stores are then
				// updated from the result this callback resolves with.
				customRequest(async () => {
					// Preserve submitted values on rejection.
					const retained = get(formData);
					const shape = untrack(() => data.form);
					try {
						const result = await placeOrderCommand(retained);
						if (result.status === "accepted") {
							lastOrder = result.order;
							// Refresh the query after the mutation, without invalidating all page data.
							try {
								await refreshOrders();
							} catch {
								// Refresh failure cannot undo an accepted mutation or change its reset policy.
								refreshFailure =
									"The order was placed, but the list could not be refreshed. Open the receipt to see it.";
							}
							return {
								type: "success",
								status: 200,
								location: page.url.pathname,
								data: {
									form: {
										...shape,
										valid: true,
										message: `Placed ${result.order.id}.`,
									},
								},
							} satisfies ActionResult;
						}
						if (result.field) {
							return {
								type: "failure",
								status: 400,
								location: page.url.pathname,
								data: {
									form: {
										...shape,
										data: retained,
										valid: false,
										errors: { [result.field]: [result.message] },
										message: result.message,
									},
								},
							} satisfies ActionResult;
						}
						// The refusal belongs to no control, so it becomes a form-level error rather than an
						// invented field issue.
						return {
							type: "failure",
							status: 400,
							location: page.url.pathname,
							data: {
								form: {
									...shape,
									data: retained,
									valid: false,
									errors: { _errors: [result.message] },
									message: result.message,
								},
							},
						} satisfies ActionResult;
					} catch {
						// A command that fails its own schema, or a service that is unreachable, is not a field
						// issue: the recipe reports it as a failed request, which also finalises the submission.
						return {
							type: "error",
							status: 500,
							error: {
								status: 500,
								message: "The order service refused the request.",
							},
						} satisfies ActionResult;
					}
				});
			},
		}
	);
	const { form: formData, enhance, errors, message, submitting } = form;

	// The list, created once at component init and refreshed explicitly after a mutation.
	const orders = placedOrders();
	let orderList = $state<PlacedOrder[]>([]);
	async function refreshOrders() {
		await orders.refresh();
		orderList = orders.current ?? [];
	}

	let lastOrder = $state<PlacedOrder>();
	let commandFailure = $state("");
	let refreshFailure = $state("");
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
		void refreshOrders();
	});

	/**
	 * Sends an invalid payload straight to the command, bypassing the client pass on purpose. The
	 * command's schema rejects it before the handler runs, and what comes back is a failed request
	 * rather than field issues, which is why the recipe reports it here.
	 */
	async function sendInvalidPayload() {
		commandFailure = "";
		try {
			await placeOrderCommand({ plan: "starter", seats: 0 });
		} catch {
			commandFailure =
				"The command rejected the payload before its handler ran. That is a server failure, not a field issue.";
		}
	}
</script>

<h1>A Superforms form that submits a remote command</h1>

<p>
	The form below is an ordinary SuperForm presented by Formsnap. Its submission is not an action:
	<code>onSubmit</code> registers a custom request, which calls a remote <code>command</code> and
	translates the command's result into an <code>ActionResult</code> the Superforms lifecycle already
	knows how to apply. Success, a refusal and a failed request therefore all update the real stores:
	values, errors, the message and the pending state are Superforms', not a copy of them.
</p>

<p>
	This is an application-owned integration, and it is JavaScript-dependent. A command has no
	native HTML form contract, so without JavaScript the form has nothing to submit to: there is no
	action or endpoint behind this page, and the recipe does not pretend <code>method="POST"</code> creates
	one.
</p>

<p>
	A command cannot <code>redirect()</code> either, so navigation stays the application's business:
	after an accepted order the page links to its receipt, which reads the same store through its
	own load. The note <code>unreachable</code> makes the store throw, which is how the recipe shows an
	unexpected failure that leaves no pending state behind.
</p>

<p data-testid="command-js-note">
	JavaScript is required for this recipe. The list below, the mutation and the receipt link all
	depend on it.
</p>

<form method="POST" use:enhance data-testid="recipe-remote-command" data-hydrated={hydrated}>
	<Field {form} name="plan">
		<Control>
			{#snippet children({ props })}
				<Label>Plan</Label>
				<select data-testid="command-plan-select" {...props} bind:value={$formData.plan}>
					<option value="starter">Starter (up to 5 seats)</option>
					<option value="pro">Pro (up to 25 seats)</option>
				</select>
			{/snippet}
		</Control>
		{#snippet fieldErrors({ errors })}
			<ol data-testid="command-plan-errors">
				{#each errors as error, index (index)}
					<li>{error}</li>
				{/each}
			</ol>
		{/snippet}
	</Field>

	<Field {form} name="seats">
		<Control>
			{#snippet children({ props })}
				<Label>Seats</Label>
				<input
					data-testid="command-seats-input"
					type="number"
					{...props}
					bind:value={$formData.seats}
				/>
			{/snippet}
		</Control>
		{#snippet description()}
			<span>A starter plan allows five seats, a pro plan twenty-five.</span>
		{/snippet}
		{#snippet fieldErrors({ errors })}
			<ol data-testid="command-seats-errors">
				{#each errors as error, index (index)}
					<li>{error}</li>
				{/each}
			</ol>
		{/snippet}
	</Field>

	<Field {form} name="note">
		<Control>
			{#snippet children({ props })}
				<Label>Note</Label>
				<input data-testid="command-note-input" {...props} bind:value={$formData.note} />
			{/snippet}
		</Control>
		{#snippet fieldErrors({ errors })}
			<ol data-testid="command-note-errors">
				{#each errors as error, index (index)}
					<li>{error}</li>
				{/each}
			</ol>
		{/snippet}
	</Field>

	{#if $errors._errors?.length}
		<!-- A refusal that belongs to no control is form feedback, not an invented field error. -->
		<ul data-testid="command-form-errors">
			{#each $errors._errors as error, index (index)}
				<li>{error}</li>
			{/each}
		</ul>
	{/if}

	<button type="submit" disabled={$submitting} data-testid="command-submit">
		{#if $submitting}
			<span data-testid="command-pending">Placing…</span>
		{:else}
			Place order
		{/if}
	</button>

	<button type="button" data-testid="command-invalid" onclick={sendInvalidPayload}>
		Send an invalid payload to the command
	</button>

	{#if $message}
		<output data-testid="command-message">{$message}</output>
	{/if}
	<!-- The region stays in the document so it can announce a failure when one happens, and so a
	     reader does not have to look for an element that only exists after the fact. -->
	<p data-testid="command-failure" aria-live="polite">{commandFailure}</p>
	<p data-testid="command-refresh-failure" aria-live="polite">{refreshFailure}</p>
	{#if lastOrder}
		<p>
			<a
				data-testid="command-receipt"
				href={resolve("/recipes/remote-command/receipt/[id]", { id: lastOrder.id })}
				>Open the receipt for {lastOrder.id}</a
			>
		</p>
	{/if}
</form>

<h2 data-testid="command-list-title">Placed orders</h2>
<ul data-testid="command-list">
	{#each orderList as order (order.id)}
		<li>{order.id}: {order.seats} seats on the {order.plan} plan</li>
	{/each}
</ul>
