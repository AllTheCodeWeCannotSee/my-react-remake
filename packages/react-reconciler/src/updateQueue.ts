import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';

// ---------------------------------- Update --------------------------------- //
// 触发更新的方式1. ReactDOM.createRoot().render
// Update = { action: <App />}
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
	dispatch: Dispatch<State> | null;
}
export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>;
};

export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	updateQueue.shared.pending = update;
};

// 1
// baseState = null | <App />
// pending = { action: <App />}

export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null
): { memoizedState: State } => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState
	};
	if (pendingUpdate !== null) {
		const action = pendingUpdate.action;
		if (action instanceof Function) {
			result.memoizedState = action(baseState);
		} else {
			result.memoizedState = action;
		}
	}
	return result;
};
