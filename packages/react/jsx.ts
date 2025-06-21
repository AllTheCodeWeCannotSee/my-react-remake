/* eslint-disable @typescript-eslint/no-explicit-any */
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import {
	ElementType,
	Key,
	Props,
	ReactElementType,
	Ref,
	Type
} from 'shared/ReactTypes';

// jsx
// <div id="main">
//   <h1>Hello</h1>
//   <p>World</p>
//   Some text
// </div>

// babel
// /*#__PURE__*/ React.createElement(
//     "div",
//     {
//       id: "main"
//     },
//     /*#__PURE__*/ React.createElement("h1", null, "Hello"),
//     /*#__PURE__*/ React.createElement("p", null, "World"),
//     "Some text"
//   );

export function jsx(
	type: ElementType,
	config: any,
	...maybeChildren: any
): ReactElementType {
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;
	for (const k in config) {
		const v = config[k];
		if (k === 'key') {
			if (v !== undefined) {
				key = '' + v;
			}
			continue;
		}
		if (k === 'ref') {
			if (v !== undefined) {
				ref = v;
			}
			continue;
		}
		if ({}.hasOwnProperty.call(config, k)) {
			props[k] = v;
		}
	}
	props.children =
		maybeChildren?.length === 1 ? maybeChildren[0] : maybeChildren;
	return ReactElement(type, key, ref, props);
}

function ReactElement(
	type: Type,
	key: Key,
	ref: Ref,
	props: Props
): ReactElementType {
	const element = {
		$$typeof: REACT_ELEMENT_TYPE,
		type,
		key,
		ref,
		props
	};
	return element;
}
