export type Flags = number;

export const NoFlags = 0b00000000000000000000000000;
export const Placement = 0b00000000000000000000000001;
export const Update = 0b00000000000000000000000010;
export const ChildDeletion = 0b00000000000000000000000100;

// useEffect
export const PassiveEffect = 0b00000000000000000000001000; // 此 fiber 内有 useEffect 需要处理

// useRef
export const Ref = 0b00000000000000000000010000;

// ............ suspense ............
// 处理可见性
export const Visibility = 0b00000000000000000000100000;
// 挂起
export const DidCapture = 0b00000000000000000001000000;
export const ShouldCapture = 0b00000000000000000010000000; //
// ---------------------------------- 组合 --------------------------------- //
export const MutationMask =
	Placement | Update | ChildDeletion | Ref | Visibility;
export const LayoutMask = Ref;
// 被动副作用，完成 DOM 后异步执行
// 宁可错杀，不可放过
// PassiveEffect: create 回调
// ChildDeletion: destroy 回调
export const PassiveMask = PassiveEffect | ChildDeletion;
// 对宿主环境产生影响的副作用的总和
export const HostEffectMask =
	MutationMask | LayoutMask | PassiveMask | DidCapture;
