import { FiberNode } from './fiber';

// function Greeting(props: { name: string }) {
//     return <span>你好，{props.name}！</span>;
// }

// function App() {
//     return (
//         <div>
//             <Greeting name="世界" />
//         </div>
//     );
// }
export function renderWithHooks(wip: FiberNode) {
	// wip.type: 这个 type 属性对于函数式组件来说，就是那个组件函数本身
	// Component 是 Greeting()
	const Component = wip.type;
	// props = { name: "世界" }
	const props = wip.pendingProps;
	// children = <span>你好，世界！</span>
	const children = Component(props);
	return children;
}
