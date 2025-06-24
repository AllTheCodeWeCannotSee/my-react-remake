import { ReactElementType } from 'shared/ReactTypes';
import { createFiberFromElement, FiberNode } from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { Placement } from './fiberFlags';

export const mountChildFibers = ChildReconciler(false);
export const reconcileChildFibers = ChildReconciler(true);

/**
 * @description 由element生成fiber，并挂载到父节点上
 */
function ChildReconciler(shouldTrackEffects: boolean) {
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
	// 1. 根据elemnet创建fiber
	// 2. fiber的树形结构
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		const fiber = createFiberFromElement(element);
		fiber.return = returnFiber;
		return fiber;
	}
	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		// updateHostRoot: reconcileChildFibers(hostFiber, currentFiber, <App />)
		//
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
		return null;
	};
}
