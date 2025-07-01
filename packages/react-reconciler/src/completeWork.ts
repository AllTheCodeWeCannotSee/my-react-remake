import {
	appendInitialChild,
	createInstance,
	createTextInstance
} from 'react-dom/src/hostConfig';
import { FiberNode } from './fiber';
import { NoFlags, Update } from './fiberFlags';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';
import { Container } from './hostConfig';
import { updateFiberProps } from 'react-dom/src/SyntheticEvent';

// ---------------------------------- completeWork --------------------------------- //
export const completeWork = (wip: FiberNode) => {
	const newProps = wip.pendingProps;
	const current = wip.alternate;
	switch (wip.tag) {
		case HostRoot:
			bubbleProperties(wip);
			return null;
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// update
				updateFiberProps(wip.stateNode, newProps);
			} else {
				// mount
				// 1. 构建wip-DOM
				const instance = createInstance(wip.type, newProps);
				// 2. 将 child-DOM 插入 wip-DOM 中
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memoizedProps?.content;
				const newText = newProps.content;
				if (oldText !== newText) {
					// 新旧文本不同
					markUpdate(wip);
				}
			} else {
				const instance = createTextInstance(newProps.content);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case FunctionComponent:
			bubbleProperties(wip);
			return null;
		case Fragment:
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.warn('未处理的completeWork情况', wip);
			}
			break;
	}
};

// ---------------------------------- 辅助函数 --------------------------------- //
function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags;
	let child = wip.child;
	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}
	wip.subtreeFlags |= subtreeFlags;
}

/**
 * @description 把一个父 DOM 节点和它所有子孙后代中实际的 DOM 节点（或文本节点）连接起来
 * @param parent 真实 DOM 元素
 * @param wip 该DOM元素对应的fiber-node
 */
// 和commitWork流程类似，先向下遍历找到Host，处理Host，再向上遍历兄弟节点/父节点
function appendAllChildren(parent: Container, wip: FiberNode) {
	let node = wip.child;
	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node?.stateNode);
		} else if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}
		if (node === wip) {
			return;
		}
		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return;
			}
			node = node?.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}
// 给 fiber 打上 Update 标签
function markUpdate(fiber: FiberNode) {
	fiber.flags |= Update;
}
