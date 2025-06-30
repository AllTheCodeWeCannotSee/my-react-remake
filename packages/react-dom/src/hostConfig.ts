import { FiberNode } from 'react-reconciler/src/fiber';
import { HostText } from 'react-reconciler/src/workTags';
import { DOMElement, updateFiberProps } from './SyntheticEvent';
import { Props } from 'shared/ReactTypes';

// ---------------------------------- 各种类型 --------------------------------- //
export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

// ---------------------------------- 主体 --------------------------------- //
export function commitUpdate(fiber: FiberNode) {
	switch (fiber.tag) {
		case HostText:
			const text = fiber.memoizedProps?.content;
			return commitTextUpdate(fiber.stateNode, text);
		default:
			if (__DEV__) {
				console.warn('未实现的Update类型', fiber);
			}
			break;
	}
}

// ---------------------------------- 父子操作 --------------------------------- //
export const appendInitialChild = (
	parent: Instance | Container,
	child: Instance
) => {
	parent.appendChild(child);
};

export const appendChildToContainer = appendInitialChild;

export function removeChild(
	child: Instance | TextInstance,
	container: Container
) {
	container.removeChild(child);
}

// 把 child1 插入 parent 中，并制定插入到 child2 前面
export function insertChildToContainer(
	child: Instance,
	container: Container,
	before: Instance
) {
	container.insertBefore(child, before);
}

// ---------------------------------- 单节点操作 --------------------------------- //
// 创建 hostComponent
export const createInstance = (type: string, props: Props): Instance => {
	const element = document.createElement(type) as unknown;
	updateFiberProps(element as DOMElement, props);
	return element as DOMElement;
};
// 创建 hostText
export const createTextInstance = (content: string) => {
	return document.createTextNode(content);
};

// update hostText
export function commitTextUpdate(textInstance: TextInstance, content: string) {
	textInstance.textContent = content;
}
