import { Action } from 'shared/ReactTypes';

// setCount(1)
// setCount( pre => pre + 1 )
export type Dispatch<State> = (action: Action<State>) => void;

// const [count, setCount] = useState(0)
export interface Dispatcher {
	useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>];
}

const currentDispatcher: { current: Dispatcher | null } = {
	current: null
};

export const resolveDispatcher = () => {
	const dispatcher = currentDispatcher.current;

	if (dispatcher === null) {
		throw new Error('hook只能在函数组件中执行');
	}
	return dispatcher;
};

export default currentDispatcher;
