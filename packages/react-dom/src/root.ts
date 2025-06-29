import { Container } from 'hostConfig';
import {
	createContainer,
	updateContainer
} from 'react-reconciler/src/fiberReconciler';

import { ReactElementType } from 'shared/ReactTypes';
import { initEvent } from './SyntheticEvent';

// ReactDOM.createRoot(root).render(<App/>)
export function createRoot(container: Container) {
	const root = createContainer(container);
	return {
		render(element: ReactElementType) {
			// 注册事件
			initEvent(container, 'click');
			// 触发render
			return updateContainer(element, root);
		}
	};
}
