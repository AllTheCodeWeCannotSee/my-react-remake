import { Container } from 'hostConfig';
import {
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_runWithPriority,
	unstable_UserBlockingPriority
} from 'scheduler';
import { Props } from 'shared/ReactTypes';

// ---------------------------------- 数据结构 --------------------------------- //
export const elementPropsKey = '__props';

// 例子:
// <button
//   onClick={() => { console.log('已点击！'); }}
//   className="btn-primary"
//   disabled={false}
// > 点我 </button>
// targetElement[elementPropsKey]的值:
// {
//     onClick: () => { console.log('已点击！'); },
//     className: 'btn-primary',
//     disabled: false,
//     children: '点我'
// }

export interface DOMElement extends Element {
	[elementPropsKey]: Props;
}
const validEventTypeList = ['click'];

type EventCallback = (e: Event) => void;

interface Paths {
	capture: EventCallback[];
	bubble: EventCallback[];
}

interface SyntheticEvent extends Event {
	__stopPropagation: boolean;
}

// ---------------------------------- 主体 --------------------------------- //
// 初始化事件监听的入口，所有该类型的事件（比如所有的点击事件）都会先被这个根容器上的监听器捕获
// container: DOM 根节点
// eventType: 事件类型
export function initEvent(container: Container, eventType: string) {
	// 不支持的事件类型
	if (!validEventTypeList.includes(eventType)) {
		console.warn('当前不支持', eventType, '事件');
		return;
	}
	if (__DEV__) {
		console.log('初始化事件：', eventType);
	}
	container.addEventListener(eventType, (e) => {
		dispatchEvent(container, eventType, e);
	});
}
// 把一个 React 元素（FiberNode）的 props 对象存储到它对应的真实 DOM 节点的 __props 属性
export function updateFiberProps(node: DOMElement, props: Props) {
	node[elementPropsKey] = props;
}

// ---------------------------------- 辅助函数 --------------------------------- //
// 点击后执行
function dispatchEvent(container: Container, eventType: string, e: Event) {
	const targetElement = e.target;
	if (targetElement === null) {
		console.warn('事件不存在target', e);
		return;
	}
	const { bubble, capture } = collectPaths(
		targetElement as DOMElement,
		container,
		eventType
	);

	const se = createSyntheticEvent(e);
	triggerEventFlow(capture, se);

	if (!se.__stopPropagation) {
		triggerEventFlow(bubble, se);
	}
}

// 从下向上遍历, 收集各个节点的 click 的 callback (冒泡&捕获)
function collectPaths(
	targetElement: DOMElement,
	container: Container,
	eventType: string
) {
	const paths: Paths = {
		capture: [],
		bubble: []
	};
	// 向上遍历
	while (targetElement && targetElement !== container) {
		// 1. 收集此 Element 的 Props
		// elementProps = {
		//     onClick: () => { console.log('已点击！'); },
		//     className: 'btn-primary',
		//     disabled: false,
		//     children: '点我'
		// }
		const elementProps = targetElement[elementPropsKey];
		if (elementProps) {
			// 2. 收集 eventType 对应的 callback 的名称
			// callbackNameList = ['onClickCapture', 'onClick']
			const callbackNameList = getEventCallbackNameFromEventType(eventType);
			if (callbackNameList) {
				callbackNameList.forEach((callbackName, i) => {
					// eventCallback = () => { console.log('已点击！');
					const eventCallback = elementProps[callbackName];
					if (eventCallback) {
						if (i === 0) {
							// 捕获
							// [父, 子]
							paths.capture.unshift(eventCallback);
						} else {
							// 冒泡
							// [子, 父]
							paths.bubble.push(eventCallback);
						}
					}
				});
			}
		}
		targetElement = targetElement.parentNode as DOMElement;
	}
	return paths;
}

// input: 'click'
// out: ['onClickCapture', 'onClick']
function getEventCallbackNameFromEventType(
	eventType: string
): string[] | undefined {
	return {
		// 顺序重要，[捕获，冒泡]
		click: ['onClickCapture', 'onClick']
	}[eventType];
}

// 原生事件 -> 合成事件 : 重写 stopPropagation
function createSyntheticEvent(e: Event) {
	const syntheticEvent = e as SyntheticEvent;
	syntheticEvent.__stopPropagation = false;
	const originStopPropagation = e.stopPropagation;

	// 重写原生事件的 stopPropagation 方法
	syntheticEvent.stopPropagation = () => {
		syntheticEvent.__stopPropagation = true;
		if (originStopPropagation) {
			originStopPropagation();
		}
	};
	return syntheticEvent;
}

// 对 bubble/capture 整个路径上的 callback 进行调用
function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
	for (let i = 0; i < paths.length; i++) {
		// callback = () => { console.log('已点击！');
		const callback = paths[i];
		// callback执行 + 创建优先级上下文
		unstable_runWithPriority(eventTypeToSchdulerPriority(se.type), () => {
			callback.call(null, se);
		});
		if (se.__stopPropagation) {
			break;
		}
	}
}

// 用户事件 -> scheduler优先级
function eventTypeToSchdulerPriority(eventType: string) {
	switch (eventType) {
		case 'click':
		case 'keydown':
		case 'keyup':
			return unstable_ImmediatePriority;
		case 'scroll':
			return unstable_UserBlockingPriority;
		default:
			return unstable_NormalPriority;
	}
}
