import { FiberNode } from './fiber';
import { popProvider } from './fiberContext';
import { DidCapture, NoFlags, ShouldCapture } from './fiberFlags';
import { popSuspenseHandler } from './suspenseContext';
import { ContextProvider, SuspenseComponent } from './workTags';

export function unwindWork(wip: FiberNode) {
	const flags = wip.flags;
	switch (wip.tag) {
		case SuspenseComponent:
			// <suspense>
			popSuspenseHandler();
			if (
				(flags & ShouldCapture) !== NoFlags &&
				(flags & DidCapture) === NoFlags
			) {
				wip.flags = (flags & ~ShouldCapture) | DidCapture;
				return wip;
			}
			return null;
		case ContextProvider:
			// <context>
			const context = wip.type._context;
			popProvider(context);
			return null;
		default:
			// 当前 wip 不是捕手：<context> / <suspense>
			return null;
	}
}
