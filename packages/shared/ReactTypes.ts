/* eslint-disable @typescript-eslint/no-explicit-any */

export type Type = any;
export type Ref = any;
export type Key = any;
export type ElementType = any;
export type Props = any;

/**
 * @description jsx生成的react元素
 */
export interface ReactElementType {
	$$typeof: symbol | number;
	type: ElementType;
	key: Key;
	props: Props;
	ref: Ref;
}

export type Action<State> = State | ((preState: State) => State);
