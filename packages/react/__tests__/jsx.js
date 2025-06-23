// test.js

// --- 模拟环境依赖 ---
// 在真实的 React 中，这些是从 'shared' 包导入的
// 为了让文件能独立运行，我们在这里简单定义一下
const REACT_ELEMENT_TYPE = Symbol.for('react.element');
// --- 依赖结束 ---

// --- 你提供的代码 ---
// (为了在 Node.js 中直接运行，我移除了 TypeScript 类型注解)
function ReactElement(type, key, ref, props) {
	const element = {
		$$typeof: REACT_ELEMENT_TYPE,
		type,
		key,
		ref,
		props
	};
	return element;
}

// 注意：我修正了你代码中的一个小笔误
// key 应该是属性的值(v)，而不是属性名(k)。
// 原始代码: key += '' + k;
// 修正后: key = '' + v;
export function jsx(type, config, ...maybeChildren) {
	let key = null;
	const props = {};
	let ref = null;

	// config 可能为 null，比如 jsx('h1', null, 'text')
	if (config !== null) {
		for (const k in config) {
			const v = config[k];
			if (k === 'key') {
				if (v !== undefined) {
					// 修正点：key 的值应该是 v
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
	}

	const childrenLength = maybeChildren.length;
	if (childrenLength === 1) {
		props.children = maybeChildren[0];
	} else if (childrenLength > 1) {
		props.children = maybeChildren;
	}

	return ReactElement(type, key, ref, props);
}
// --- 你的代码结束 ---

// --- 测试执行区域 ---

// 1. 手动编写 Babel 会生成的函数调用
const elementToTest = jsx(
	'div', // type
	{ id: 'main', key: '123' }, // config (props)
	jsx('h1', null, 'Hello World'), // ...maybeChildren[0]
	'Some text node.' // ...maybeChildren[1]
);

// 2. 打印结果进行验证
console.log('JSX 测试结果:');
// 使用 console.dir 可以更好地查看对象结构
console.dir(elementToTest, { depth: null });

/*
// 你也可以用 JSON.stringify 查看，但 Symbol 类型的 $$typeof 不会显示
console.log(JSON.stringify(elementToTest, null, 2));
*/
