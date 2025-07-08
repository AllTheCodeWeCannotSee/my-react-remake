export type Type = any;
// Ref 的2种数据结构
// (instance: T) => void
// {current: T}
export type Ref = ((instance: any) => void) | { current: any } | null;
export type Key = any;
export type ElementType = any;
export type Props = any;

// jsx生成的react元素
export interface ReactElementType {
	$$typeof: symbol | number;
	type: ElementType;
	key: Key;
	props: Props;
	ref: Ref;
}

export type Action<State> = State | ((preState: State) => State);

// context
// 放在 fiber.type 中
export type ReactProviderType<T> = {
	$$typeof: symbol | number;
	_context: ReactContext<T> | null;
};
export type ReactContext<T> = {
	$$typeof: symbol | number;
	Provider: ReactProviderType<T> | null;
	_currentValue: T;
};
