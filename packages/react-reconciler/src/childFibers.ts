import { Key, Props, ReactElementType } from 'shared/ReactTypes';
import {
	createFiberFromElement,
	createFiberFromFragment,
	createWorkInProgress,
	FiberNode
} from './fiber';
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
import { ChildDeletion, Placement } from './fiberFlags';
import { Fragment, HostText } from './workTags';

type ExistingChildren = Map<string | number, FiberNode>;

export const mountChildFibers = ChildReconciler(false);
export const reconcileChildFibers = ChildReconciler(true);

/**
 * @description 由element生成fiber，并挂载到父节点上
 */
function ChildReconciler(shouldTrackEffects: boolean) {
	// ---------------------------------- 处理副作用 --------------------------------- //
	/**
	 * @description 如果新生成的 fiber 是 1. update阶段 2. 有alternate, 则打上 Placement
	 * @param fiber 刚刚由 element 生成的 fiber
	 */
	function placeSingleChild(fiber: FiberNode) {
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags |= Placement;
		}
		return fiber;
	}
	// returnFiber.deletions 为空: 1. returnFiber 打上标签 2. childToDelete 入队
	// returnFiber.deletions 不空: 2. childToDelete 入队
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		if (!shouldTrackEffects) {
			return;
		}
		const deletions = returnFiber.deletions;
		if (deletions === null) {
			returnFiber.deletions = [childToDelete];
			returnFiber.flags |= ChildDeletion;
		} else {
			deletions.push(childToDelete);
		}
	}
	// 将从 currentFirstChild 开始的所有子节点入队到 returnFiber.deletions
	function deleteRemainingChildren(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null
	) {
		if (!shouldTrackEffects) {
			return;
		}
		let childToDelete = currentFirstChild;
		while (childToDelete) {
			deleteChild(returnFiber, childToDelete);
			childToDelete = childToDelete.sibling;
		}
	}

	// ---------------------------------- reconcile 各种类型的子元素  --------------------------------- //
	// 单节点指的是更新后是单节点
	// 1. 根据 elemnet 创建 fiber
	// 2. fiber 的树形结构
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		// 处理删除
		const key = element.key;
		while (currentFiber !== null) {
			// update 才会有 delete
			if (currentFiber.key === key) {
				// key 相同
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === element.type) {
						// 如果这个单节点 element 非 Fragment 类型, props = element.props;
						let props = element.props;
						// 如果这个单节点 element 是 Fragment 类型, props = element.props.children;
						if (element.type === REACT_FRAGMENT_TYPE) {
							// // fragment情况1: 单节点：Fragment 包裹其他组件
							props = element.props.children;
						}
						// 1. type 相同, 使用老节点, 更新老节点 props, 返回老节点
						const existing = useFiber(currentFiber, props);
						existing.return = returnFiber;
						// ABC -> A, 当确定 A 的 key & type 不变后, 不必再循环 BC
						deleteRemainingChildren(returnFiber, currentFiber.sibling);
						return existing;
					} else {
						// 2. type 不同: 将其和兄弟节点打上删除标记, 结束循环
						deleteRemainingChildren(returnFiber, currentFiber);
						break;
					}
				} else {
					if (__DEV__) {
						console.warn('还未实现的react类型', element);
						break;
					}
				}
			} else {
				// 3. key 不同: 打上删除标记, 结束 work
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
			}
		}
		// mount 时与 update 时的情况2、3: 根据element创建fiber
		let fiber;
		if (element.type === REACT_FRAGMENT_TYPE) {
			// element 是 fragment
			fiber = createFiberFromFragment(element.props.children, key);
		} else {
			// element 不是 fragment
			fiber = createFiberFromElement(element);
		}
		fiber.return = returnFiber;
		return fiber;
	}
	// 1. 根据 content 创建 HostTextFiber
	// 2. fiber的树形结构
	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		// 处理删除的情况
		while (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				// type 相同, 复用, 返回老节点
				const existing = useFiber(currentFiber, { content });
				existing.return = returnFiber;
				deleteRemainingChildren(returnFiber, currentFiber.sibling);
				return existing;
			} else {
				// type 不同, 打上删除标记
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
			}
		}
		// 处理 mount 或者是 update时删除后的新建节点
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}
	// 多节点 diff
	// 返回新的子节点链表的第一个
	function reconcileChildrenArray(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null, // currentFirstChild 是 current tree 的父节点的第一个子节点
		newChild: any[]
	) {
		let lastPlacedIndex: number = 0; // 旧链表中，最后一个可被复用且不需要移动的节点的位置
		let lastNewFiber: FiberNode | null = null; // 新链表的“头指针”
		let firstNewFiber: FiberNode | null = null; // 新链表的“尾指针

		// 1. 将current中所有同级fiber保存在Map中
		const existingChildren: ExistingChildren = new Map();
		let current = currentFirstChild;
		while (current !== null) {
			const keyToUse = current.key !== null ? current.key : current.index;
			existingChildren.set(keyToUse, current);
			current = current.sibling;
		}

		// 遍历 newChild 数组
		for (let i = 0; i < newChild.length; i++) {
			const after = newChild[i];
			// 2. 能复用就复用
			const newFiber = updateFromMap(returnFiber, existingChildren, i, after);
			if (newFiber === null) {
				continue;
			}
			// 完善 newFiber 的属性
			newFiber.index = i;
			newFiber.return = returnFiber; // 形成树形结构

			// 更新 新链表的头指针与尾指针
			if (lastNewFiber === null) {
				// 新链表为空
				lastNewFiber = newFiber;
				firstNewFiber = newFiber;
			} else {
				// 新链表非空
				lastNewFiber.sibling = newFiber;
				lastNewFiber = lastNewFiber.sibling;
			}
			// mount
			if (!shouldTrackEffects) {
				continue;
			}
			// update
			const current = newFiber.alternate;
			// 3. 标记移动还是插入
			if (current !== null) {
				// current 存在
				const oldIndex = current.index;
				// 旧ABC 新ACB
				if (oldIndex < lastPlacedIndex) {
					// 当遍历到 B 时, oldIndex = 1; lastPlacedIndex = 2;
					// 标记移动
					newFiber.flags |= Placement;
				} else {
					// 当遍历到 C 时, oldIndex = 2; lastPlacedIndex = 0;
					// 不用打标记, 更新 lastPlacedIndex = 2
					lastPlacedIndex = oldIndex;
				}
			} else {
				// current 不存在: 当一个全新的元素被添加到列表中
				newFiber.flags |= Placement;
			}
		}
		// 4. 将Map中剩下的标记为删除
		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber);
		});
		return firstNewFiber;
	}

	// ---------------------------------- 辅助函数 --------------------------------- //

	function getElementKeyToUse(element: any, index?: number): Key {
		if (
			// element 是 1.数组 2.HostText
			Array.isArray(element) ||
			typeof element === 'string' ||
			typeof element === 'number'
		) {
			return index;
		}
		// element 非数组
		return element.key !== null ? element.key : index;
	}
	function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
		const clone = createWorkInProgress(fiber, pendingProps);
		clone.index = 0;
		clone.sibling = null;
		return clone;
	}
	// 根据 element 从旧节点中找出可复用的，基于此创建新节点
	// 存在能复用的，则复用
	// 没有能复用的，则新建
	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number, // index 当前新子元素在 newChild 数组的索引
		element: any
	): FiberNode | null {
		// keyToUse = element.key | rerurnFiber.nextProps.children 数组的下标
		const keyToUse = getElementKeyToUse(element, index);
		// before: 旧链表中对应 element 的 fiber 节点
		const before = existingChildren.get(keyToUse);
		// HostText
		if (typeof element === 'string' || typeof element === 'number') {
			if (before) {
				// 存在 map 中可复用的 fiber
				if (before.tag === HostText) {
					existingChildren.delete(keyToUse);
					return useFiber(before, { content: element + '' });
				}
			} else {
				// 不存在 map 可复用的 fiber
				return new FiberNode(HostText, { content: element + '' }, null);
			}
		}
		// ReactElement
		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					// fragment情况2: 多节点时，fragment与其他组件同级
					if (element.type === REACT_FRAGMENT_TYPE) {
						return updateFragment(
							returnFiber,
							before,
							element,
							keyToUse,
							existingChildren
						);
					}
					// 非 fragment 的情况
					if (before) {
						if (before.type === element.type) {
							// 可以复用
							existingChildren.delete(keyToUse);
							return useFiber(before, element.props);
						}
					} else {
						// 不能复用
						return createFiberFromElement(element);
					}
			}
			// fragment 情况3: 数组形式的Fragment
			if (Array.isArray(element)) {
				return updateFragment(
					returnFiber,
					before,
					element,
					keyToUse,
					existingChildren
				);
			}
		}
		return null;
	}
	// 根据 element 从旧节点中找出可复用的，基于此创建新节点
	// 存在能复用的，则复用
	// 没有能复用的，则新建
	function updateFragment(
		returnFiber: FiberNode,
		current: FiberNode | undefined,
		elements: any[],
		key: Key,
		existingChildren: ExistingChildren
	) {
		let fiber;
		if (!current || current.tag !== Fragment) {
			// 不能复用
			fiber = createFiberFromFragment(elements, key);
		} else {
			// 可以复用
			existingChildren.delete(key);
			fiber = useFiber(current, elements);
		}
		fiber.return = returnFiber;
		return fiber;
	}
	// ---------------------------------- 返回函数 --------------------------------- //
	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: any
	) {
		// 子元素是 Fragment
		// <> <ChildA /><ChildB /> </>
		const isUnkeyedTopLevelFragment =
			typeof newChild === 'object' &&
			newChild !== null &&
			newChild.type === REACT_FRAGMENT_TYPE &&
			newChild.key === null;
		if (isUnkeyedTopLevelFragment) {
			// [<ChildA />, <ChildB />]
			newChild = newChild.props.children;
		}
		// 子元素是 ReactElement
		// updateHostRoot: reconcileChildFibers(hostFiber, currentFiber, <App />)
		if (typeof newChild === 'object' && newChild !== null) {
			// 多 element 的情况 ul> li*3
			if (Array.isArray(newChild)) {
				return reconcileChildrenArray(returnFiber, currentFiber, newChild);
			}
			// 单 element 的情况
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					);
				default:
					if (__DEV__) {
						console.warn('未实现的reconcile类型', newChild);
					}
					break;
			}
		}
		// 子元素是 HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			);
		}
		// 兜底删除, newChild 不存在, currentFiber 存在
		deleteRemainingChildren(returnFiber, currentFiber);

		return null;
	};
}

// ---------------------------------- bailout --------------------------------- //
// .................
// current tree:
// A
// |-- B
// |   `-- D
// `-- C
// wip tree:
// A
// .................
// 职责：将 B C 的克隆连接到 A
export function cloneChildFibers(wip: FiberNode) {
	// A 没有子节点
	if (wip.child === null) {
		return;
	}
	// A 的第一个子节点 B
	let currentChild = wip.child;
	let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
	wip.child = newChild;
	newChild.return = wip;
	// A 的剩余子节点
	while (currentChild.sibling !== null) {
		currentChild = currentChild.sibling;
		newChild = newChild.sibling = createWorkInProgress(
			currentChild,
			currentChild.pendingProps
		);
		newChild.return = wip;
	}
}
