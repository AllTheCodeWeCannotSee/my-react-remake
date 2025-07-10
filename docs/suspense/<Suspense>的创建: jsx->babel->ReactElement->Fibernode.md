### _jsx_

```jsx
<Suspense fallback={<p>Loading...</p>}>
	<MyComponent />
</Suspense>
```

⬇️

### _babel （静态编译）_

Babel 在文件顶部添加了 import { Suspense } from 'react';

Suspense 是一个变量（Identifier），而不是一个 Symbol 或者字符串。Babel 只是忠实地把这个变量名放在了函数调用的第一个参数位置。

```js
import { jsx as _jsx } from 'react/jsx-runtime';
import { Suspense } from 'react';
/*#__PURE__*/ _jsx(Suspense, {
	fallback: _jsx('p', {
		children: 'Loading...'
	}),
	children: _jsx(MyComponent, {})
});
```

⬇️

### 运行时 _ReactElement_

```js
const suspenseElement = {
    $$typeof: Symbol.for('react.element'),

    // 重点：type 字段的值就是 Suspense 对象本身
   type: Symbol.for('react.suspense'),

    key: null,
    ref: null,
    props: {
        fallback: ReactElement(<p></p>)
        children: ReactElement(<MyComponent />)
    }
};
```

⬇️

_`createFiberFromElement()`_

⬇️

### FiberNode

```js
const suspenseFiberNode = {
    tag: 13, // SuspenseComponent
    // key 和 type 直接从 ReactElement 继承而来
    key: null,
    type: Symbol.for('react.suspense'),

    // pendingProps 也直接来自 ReactElement.props
    pendingProps: {
        fallback: ReactElement(<p></p>)
        children: ReactElement(<MyComponent />)
    }
};
```
