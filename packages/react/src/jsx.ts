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

// ---------------------------------- 一个例子 --------------------------------- //
// ---------------------------------- jsx --------------------------------- //
// <div id="greeting" className="container">
//   Hello, World!
// </div>
// ---------------------------------- babel --------------------------------- //
// jsx('div', { id: 'greeting', className: 'container' }, 'Hello, World!');

// ---------------------------------- 结果 --------------------------------- //
// {
// 	$$typeof: REACT_ELEMENT_TYPE,
// 	type: 'div',
// 	key: null,
// 	ref: null,
// 	props: {
// 	  id: 'greeting',
// 	  className: 'container',
// 	  children: 'Hello, World!'
// 	}
//   }

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

export const jsxDEV = (type: ElementType, config: any) => {
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;

	for (const prop in config) {
		const val = config[prop];
		if (prop === 'key') {
			if (val !== undefined) {
				key = '' + val;
			}
			continue;
		}
		if (prop === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}
		if ({}.hasOwnProperty.call(config, prop)) {
			props[prop] = val;
		}
	}

	return ReactElement(type, key, ref, props);
};
