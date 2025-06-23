import {
	createContainer,
	updateContainer
} from 'react-reconclier/src/fiberReconciler';
import { Container } from 'react-reconclier/src/hostConfig';
import { ReactElementType } from 'shared/ReactTypes';

// ReactDOM.createRoot(root).render(<App/>)
export function createRoot(container: Container) {
	const root = createContainer(container);
	return {
		render(element: ReactElementType) {
			updateContainer(element, root);
		}
	};
}
