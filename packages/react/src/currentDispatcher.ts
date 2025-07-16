// 存储了当前的操作的 hooks

import { HookDeps } from 'react-reconciler/src/fiberHooks';
import { Action, ReactContext, Usable } from 'shared/ReactTypes';

// setCount(1)
// setCount( pre => pre + 1 )
export type Dispatch<State> = (action: Action<State>) => void;

// const [count, setCount] = useState(0)

// const [isPending, startTransition] = useTransition();
// startTransition(() => { setTab(nextTab) });

// ref 是对象
// const ref = useRef(initialValue)
// ref.current = 123
// ref 是函数
// ref={(dom) => console.warn('dom is:', dom)

// const SomeContext = createContext(defaultValue)

export interface Dispatcher {
	useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>];
	useEffect: (callback: () => void, deps: HookDeps | undefined) => void;
	useTransition: () => [boolean, (callback: () => void) => void];
	useRef: <T>(initialState: T) => { current: T };
	useContext: <T>(context: ReactContext<T>) => T;
	use: <T>(usable: Usable<T>) => T;
	useCallback: <T>(callback: T, deps: HookDeps | undefined) => T;
	useMemo: <T>(nextCreate: () => T, deps: HookDeps | undefined) => T;
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
