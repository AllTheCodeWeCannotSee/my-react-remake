import { Props, ReactElementType } from 'shared/ReactTypes';
import {
	createFiberFromElement,
	createWorkInProgress,
	FiberNode
} from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { ChildDeletion, Placement } from './fiberFlags';
import { HostText } from './workTags';

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

	// ---------------------------------- 处理各种类型的 fibernode --------------------------------- //
	// 1. 根据elemnet创建fiber
	// 2. fiber的树形结构
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		// 处理删除
		const key = element.key;
		work: if (currentFiber !== null) {
			// update 才会有 delete
			if (currentFiber.key === key) {
				// key 相同
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === element.type) {
						// 1. type 相同, 使用老节点, 更新老节点 props, 返回老节点
						const existing = useFiber(currentFiber, element.props);
						existing.return = returnFiber;
						return existing;
					} else {
						// 2. type 不同: 打上删除标记, 结束 work
						deleteChild(returnFiber, currentFiber);
						break work;
					}
				} else {
					if (__DEV__) {
						console.warn('还未实现的react类型', element);
						break work;
					}
				}
			} else {
				// 3. key 不同: 打上删除标记, 结束 work
				deleteChild(returnFiber, currentFiber);
			}
		}
		// mount 与 update的情况2&3: 根据element创建fiber
		const fiber = createFiberFromElement(element);
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
		if (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				// type 相同, 复用, 返回老节点
				const existing = useFiber(currentFiber, { content });
				existing.return = returnFiber;
				return existing;
			} else {
				// type 不同, 打上删除标记
				deleteChild(returnFiber, currentFiber);
			}
		}
		// 处理 mount 或者是 update时删除后的新建节点
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}

	// ---------------------------------- 辅助函数 --------------------------------- //

	function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
		const clone = createWorkInProgress(fiber, pendingProps);
		clone.index = 0;
		clone.sibling = null;
		return clone;
	}
	// ---------------------------------- 返回函数 --------------------------------- //
	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		// updateHostRoot: reconcileChildFibers(hostFiber, currentFiber, <App />)
		if (typeof newChild === 'object' && newChild !== null) {
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
		// HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			);
		}
		// 兜底删除, newChild 不存在, currentFiber 存在
		if (currentFiber !== null) {
			deleteChild(returnFiber, currentFiber);
		}
		if (__DEV__) {
			console.warn('未实现的reconcile类型', newChild);
		}
		return null;
	};
}
