// 存储了当前的操作的 hooks

import { Action } from 'shared/ReactTypes';

// setCount(1)
// setCount( pre => pre + 1 )
export type Dispatch<State> = (action: Action<State>) => void;

// const [count, setCount] = useState(0)

// const [isPending, startTransition] = useTransition();
// startTransition(() => { setTab(nextTab) });

export interface Dispatcher {
	useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>];
	useEffect: (callback: () => void, deps: any[] | void) => void;
	useTransition: () => [boolean, (callback: () => void) => void];
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
