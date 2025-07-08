import { ReactContext } from 'shared/ReactTypes';

let prevContextValue: any = null;
const prevContextValueStack: any[] = [];

// const ctxA = createContext('deafult A');
// <ctxA.Provider value={'A1'}>
export function pushProvider<T>(context: ReactContext<T>, newValue: T) {
	prevContextValueStack.push(prevContextValue); // prevContextValueStack = [null]
	prevContextValue = context._currentValue; // prevContextValue = 'deafult A'
	context._currentValue = newValue; // 'A1'
}

export function popProvider<T>(context: ReactContext<T>) {
	context._currentValue = prevContextValue;
	prevContextValue = prevContextValueStack.pop();
}
