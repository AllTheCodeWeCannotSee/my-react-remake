import { FiberNode } from './fiber';

const suspenseHandlerStack: FiberNode[] = [];
export function pushSuspenseHandler(handler: FiberNode) {
	suspenseHandlerStack.push(handler);
}
