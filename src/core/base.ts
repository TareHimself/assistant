import { ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'stream';
import { BoundEvent, BoundEventCallback, BoundEventTarget } from './types';

export type NoParamCallback = () => void | Promise<void>;

export abstract class AssistantObject extends EventEmitter {
	get assistant() {
		return bus.assistant;
	}
}
export const enum ELoadableState {
	INACTIVE = 'Inactive',
	ACTIVE = 'Active',
	LOADING = 'Loading',
	DESTROYING = 'Destroying',
}

export abstract class Loadable extends AssistantObject {
	events: BoundEvent[] = [];
	private _state: ELoadableState = ELoadableState.INACTIVE;
	_stateCallbacks: Map<ELoadableState, NoParamCallback[]> = new Map();
	constructor() {
		super();
	}

	set state(newState: ELoadableState) {
		if (newState === ELoadableState.INACTIVE) {
			for (let i = 0; i < this.events.length; i++) {
				this.events[i].target.off(
					this.events[i].event,
					this.events[i].callback
				);
			}

			this.events = [];
		}

		if (this._stateCallbacks.has(newState)) {
			this._stateCallbacks.get(newState)!.forEach((c) => c());
			this._stateCallbacks.delete(newState);
		}

		this._state = newState;
	}

	get state() {
		return this._state;
	}

	// Events added will be automatically unbound once this class is destroyed
	addBoundEvent(
		target: BoundEventTarget,
		event: string,
		callback: BoundEventCallback
	) {
		this.events.push({
			target,
			event,
			callback,
		});
	}

	addBoundEvents(events: BoundEvent[]) {
		this.events.push.apply(this.events, events);
	}

	async waitAndSetState(
		newState: ELoadableState,
		waitForState: ELoadableState
	) {
		if (this.state === newState) {
			await this.waitForState(waitForState);
			return false;
		}
		this.state = newState;
		return true;
	}

	// child classes must set "isReady" to true at the end of this function and must call "onLoad"
	async load() {
		if (
			!(await this.waitAndSetState(
				ELoadableState.LOADING,
				ELoadableState.ACTIVE
			))
		)
			return;

		await this.onLoad();
		this.state = ELoadableState.ACTIVE;
	}

	async onLoad() {}

	async waitForState(state: ELoadableState) {
		if (this.state === state) return;
		return new Promise<void>((resolve) => {
			if (!this._stateCallbacks.has(state)) {
				this._stateCallbacks.set(state, [resolve]);
			} else {
				this._stateCallbacks.get(state)!.push(resolve);
			}
		});
	}

	// child classes must call "onDestroy" and must unbind all events
	async destroy() {
		if (
			!(await this.waitAndSetState(
				ELoadableState.DESTROYING,
				ELoadableState.INACTIVE
			))
		)
			return;

		await this.beginDestroy();

		this.state = ELoadableState.INACTIVE;
	}

	async beginDestroy() {}
}

export abstract class LoadableWithId extends Loadable {
	// an id for this class i.e. 'loadable', 'some-class'
	get id() {
		throw new Error('Something that requires an id does not have one!');
		return '';
	}
}

export class EntityExtractionError extends Error {}

export class SkillExecutionError extends Error {
	constructor(message: string) {
		super(message);
	}
}
