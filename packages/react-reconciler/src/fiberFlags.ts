export type Flags = number;

export const NoFlags = 0b0000000;
export const Placement = 0b0000001;
export const Update = 0b0000010;
export const ChildDeletion = 0b0000100;

export const PassiveEffect = 0b0001000; // 此 fiber 内有 useEffect 需要处理

export const MutationMask = Placement | Update | ChildDeletion;

// 被动副作用，完成 DOM 后异步执行
// 宁可错杀，不可放过
// PassiveEffect: create 回调
// ChildDeletion: destroy 回调
export const PassiveMask = PassiveEffect | ChildDeletion;
