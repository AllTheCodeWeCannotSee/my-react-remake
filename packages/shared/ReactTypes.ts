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

// ---------------------------------- use --------------------------------- //
// ....................................................................
// const myWakeable = {
// 	then: function(onFulfill, onReject) {
// 	  const internalPromise = new Promise((resolve, reject) => {
// 		setTimeout(() => {
// 		  const userData = { name: '张三' };
// 		  resolve(userData);
// 		}, 2000);
// 	  });
// 	  internalPromise.then(onFulfill, onReject);
// 	},
// 	status: 'pending', // 初始状态是“进行中”
// 	value: undefined, // 初始时没有值
// 	reason: undefined // 初始时没有失败原因
//   };
// ....................................................................

// use 接受的数据类型： Promise 与 Conetxt
export type Usable<T> = Thenable<T> | ReactContext<T>;

// 包装传入的 Promise
export type Thenable<T, Result = void, Err = any> =
	| UntrackedThenable<T, Result, Err>
	| PendingThenable<T, Result, Err>
	| FulfilledThenable<T, Result, Err>
	| RejectedThenable<T, Result, Err>;

export interface UntrackedThenable<T, Result, Err>
	extends ThenableImpl<T, Result, Err> {
	status?: void;
}

export interface PendingThenable<T, Result, Err>
	extends ThenableImpl<T, Result, Err> {
	status: 'pending';
}

export interface FulfilledThenable<T, Result, Err>
	extends ThenableImpl<T, Result, Err> {
	status: 'fulfilled';
	value: T;
}
export interface RejectedThenable<T, Result, Err>
	extends ThenableImpl<T, Result, Err> {
	status: 'rejected';
	reason: Err;
}

export interface ThenableImpl<T, Result, Err> {
	then(
		onFulfill: (value: T) => Result,
		onReject: (error: Err) => Result
	): void | Wakeable<Result>;
}

export interface Wakeable<Result = any> {
	then(
		onFulfill: () => Result,
		onReject: () => Result
	): void | Wakeable<Result>;
}
