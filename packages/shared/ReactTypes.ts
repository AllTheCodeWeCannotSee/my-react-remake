/* eslint-disable @typescript-eslint/no-explicit-any */

export type Type = any;
export type Ref = any;
export type Key = any;
export type ElementType = any;
export type Props = any;

export interface ReactElementType {
	$$typeof: symbol;
	type: ElementType;
	key: Key;
	props: Props;
	ref: Ref;
}
