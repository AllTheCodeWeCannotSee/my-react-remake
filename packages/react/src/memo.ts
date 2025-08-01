import { FiberNode } from 'react-reconciler/src/fiber';
import { REACT_MEMO_TYPE } from 'shared/ReactSymbols';
import { Props } from 'shared/ReactTypes';

// React.memo(function App() {/** ... */})
// fiber.type = { $$typeof: REACT_MEMO_TYPE, type: Component, ... }
export function memo(
	type: FiberNode['type'],
	compare?: (oldProps: Props, newProps: Props) => boolean
) {
	const fiberType = {
		$$typeof: REACT_MEMO_TYPE,
		type,
		compare: compare === undefined ? null : compare
	};
	return fiberType;
}
