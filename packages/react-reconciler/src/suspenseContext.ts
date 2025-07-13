import { FiberNode } from './fiber';

const suspenseHandlerStack: FiberNode[] = [];

// 将 SuspenseComponent 推入
export function pushSuspenseHandler(handler: FiberNode) {
	suspenseHandlerStack.push(handler);
}

export function popSuspenseHandler() {
	suspenseHandlerStack.pop();
}

// 获得最近挂起的 SuspenseComponent
export function getSuspenseHandler() {
	return suspenseHandlerStack[suspenseHandlerStack.length - 1];
}
