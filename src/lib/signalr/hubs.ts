import type { HubConnection } from '@microsoft/signalr';

/**
 * Typed thin wrappers around the three hubs receiver subscribes to per
 * spec §9. Phase 2 just exposes invoke/on shells; Phase 8/9 fill in the
 * domain methods.
 *
 * Implementation is generic so we don't fight TS over the domain method
 * signatures across hub variants — call sites pass the correct method
 * name + args matching the server contract.
 */

export class TypedHub {
	constructor(private readonly conn: HubConnection) {}

	invoke<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
		return this.conn.invoke<T>(method, ...args);
	}

	on(event: string, handler: (...args: unknown[]) => void): void {
		this.conn.on(event, handler);
	}

	off(event: string, handler?: (...args: unknown[]) => void): void {
		if (handler) {
			this.conn.off(event, handler);
		} else {
			this.conn.off(event);
		}
	}

	get state(): string {
		return this.conn.state;
	}

	start(): Promise<void> {
		return this.conn.start();
	}

	stop(): Promise<void> {
		return this.conn.stop();
	}

	raw(): HubConnection {
		return this.conn;
	}
}
