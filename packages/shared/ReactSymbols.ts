// ReactElement 的一个属性
// 用于构建 ReactElement

// 三类用途

// 用途 1: fiber.type.$$typeof
// fiber.type = { $$typeof: REACT_PROVIDER_TYPE, _context: ... }
// fiber.type = { $$typeof: REACT_CONTEXT_TYPE, ... }
// fiber.type = { $$typeof: REACT_MEMO_TYPE, type: Component, ... }

// 用途 2: fiber.type
// fiber.type === REACT_FRAGMENT_TYPE
// fiber.type === REACT_SUSPENSE_TYPE

// 用途3: fiber.$$typeof
//  fiber.$$type === REACT_ELEMENT_TYPE

const supportSymbol = typeof Symbol === 'function' && Symbol.for;

export const REACT_ELEMENT_TYPE = supportSymbol
	? Symbol.for('react.element')
	: 0xeac7;

export const REACT_FRAGMENT_TYPE = supportSymbol
	? Symbol.for('react.fragment')
	: 0xeacb;

// context
export const REACT_CONTEXT_TYPE = supportSymbol
	? Symbol.for('react.context')
	: 0xeaca;

export const REACT_PROVIDER_TYPE = supportSymbol
	? Symbol.for('react.provider')
	: 0xeac2;

// suspense
export const REACT_SUSPENSE_TYPE = supportSymbol
	? Symbol.for('react.suspense')
	: 0xead1;
// memo
export const REACT_MEMO_TYPE = supportSymbol
	? Symbol.for('react.memo')
	: 0xead3;
