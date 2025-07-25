import currentDispatcher, {
	Dispatcher,
	resolveDispatcher
} from './src/currentDispatcher';
import { jsxDEV } from './src/jsx';
export { createContext } from './src/context';
export { REACT_SUSPENSE_TYPE as Suspense } from 'shared/ReactSymbols';
export { memo } from './src/memo';
// React

export default {
	version: '0.0.0',
	createElement: jsxDEV
};

export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher
};

// const [count, setCount] = useState(0)
export const useState: Dispatcher['useState'] = (initialState) => {
	// 得到当前 dispatcher
	const dispatcher = resolveDispatcher();
	return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useEffect(create, deps);
};

export const useTransition: Dispatcher['useTransition'] = () => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useTransition();
};

export const useRef: Dispatcher['useRef'] = (initialValue) => {
	const dispatcher = resolveDispatcher() as Dispatcher;
	return dispatcher.useRef(initialValue);
};

// const SomeContext = createContext(defaultValue)
export const useContext: Dispatcher['useContext'] = (context) => {
	const dispatcher = resolveDispatcher() as Dispatcher;
	return dispatcher.useContext(context);
};

export const use: Dispatcher['use'] = (useable) => {
	const dispatcher = resolveDispatcher() as Dispatcher;
	return dispatcher.use(useable);
};

export const useCallback: Dispatcher['useCallback'] = (callback, deps) => {
	const dispatcher = resolveDispatcher() as Dispatcher;
	return dispatcher.useCallback(callback, deps);
};

export const useMemo: Dispatcher['useMemo'] = (nextCreate, deps) => {
	const dispatcher = resolveDispatcher() as Dispatcher;
	return dispatcher.useMemo(nextCreate, deps);
};
