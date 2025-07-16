import { memo, useCallback, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';

export default function App() {
	const [num, update] = useState(0);
	console.log('App render ', num);

	const Cpn = useMemo(() => <ExpensiveSubtree />, []);

	return (
		<div onClick={() => update(num + 100)}>
			<p>num is: {num}</p>
			{Cpn}
		</div>
	);
}

function ExpensiveSubtree() {
	console.log('ExpensiveSubtree render');
	return <p>i am child</p>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
