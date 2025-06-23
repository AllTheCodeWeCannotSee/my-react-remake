import { Action } from 'shared/ReactTypes';

// ---------------------------------- Update --------------------------------- //
export interface Update<State> {
	action: Action<State>;
}
export const createUpdate = <State>(action: Action<State>): Update<State> => {
	return {
		action
	};
};
// ---------------------------------- UpdateQueue --------------------------------- //
export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
}
export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		}
	} as UpdateQueue<State>;
};

export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	updateQueue.shared.pending = update;
};
