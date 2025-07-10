export type Flags = number;

export const NoFlags = 0b00000000000000000000000000;
export const Placement = 0b00000000000000000000000001;
export const Update = 0b00000000000000000000000010;
export const ChildDeletion = 0b00000000000000000000000100;

export const PassiveEffect = 0b00000000000000000000001000; // 此 fiber 内有 useEffect 需要处理
export const Ref = 0b00000000000000000000010000;

// suspense
export const DidCapture = 0b00000000000000000001000000; // 挂起
export const MutationMask = Placement | Update | ChildDeletion | Ref;
export const LayoutMask = Ref;
// 被动副作用，完成 DOM 后异步执行
// 宁可错杀，不可放过
// PassiveEffect: create 回调
// ChildDeletion: destroy 回调
export const PassiveMask = PassiveEffect | ChildDeletion;
