## 直观的感受 bailout

### **一个未 bailout 的例子**

每次点击 -> 触发渲染 -> 渲染 `<ExpensiveSubtree />`

```jsx
import { useState } from 'react';
import ReactDOM from 'react-dom/client';

export default function App() {
	console.log('App render ');
	const [num, update] = useState(0);
	return (
		<div>
			<button onClick={() => update(num + 1)}>+ 1</button>
			<p>num is: {num}</p>

			<ExpensiveSubtree />
		</div>
	);
}

function ExpensiveSubtree() {
	console.log('Expensive render');
	return <p>i am a child</p>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

### bailout 优化后

> 隔离：变化的内容 num vs. 不变的 ExpensiveSubtree

多次点击不会重新渲染 ExpensiveSubtree

```jsx
import { useState } from 'react';
import ReactDOM from 'react-dom/client';

export default function App() {
	console.log('App render ');
	return (
		<div>
			<Num />
			<ExpensiveSubtree />
		</div>
	);
}

function Num() {
	const [num, update] = useState(0);
	return (
		<>
			<button onClick={() => update(num + 1)}>+ 1</button>
			<p>num is: {num}</p>
		</>
	);
}

function ExpensiveSubtree() {
	console.log('Expensive render');
	return <p>i am a child</p>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```
