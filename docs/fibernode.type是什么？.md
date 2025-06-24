### `type` 的三种主要情况

`type` 的具体值，根据你 JSX 标签的性质，主要分为以下三种情况：

#### 1. HTML 原生标签 (Intrinsic Elements)

当你使用像 `<div>`, `<h1>`, `<span>` 这样的 HTML 内置标签时，`type` 会是一个**字符串**。

**示例 JSX:**

JavaScript

```
const element = <div className="greeting">Hello World</div>;
```

**编译后:**

JavaScript

```
// React.createElement('div', { className: 'greeting' }, 'Hello World')
```

生成的 React 元素 type:

type 的值就是字符串 'div'。React 在渲染时看到这个字符串，就知道需要创建一个真实的 HTML div 标签。

#### 2. 自定义组件 (Custom Components)

当你使用自己定义或从库中导入的组件时（无论是函数组件还是类组件），`type` 会是**这个组件的函数或类本身**。

**示例 JSX:**

JavaScript

```
// 这是一个函数组件
function Welcome(props) {
  return <h1>Hello, {props.name}</h1>;
}

const element = <Welcome name="Gemini" />;
```

**编译后:**

JavaScript

```
// React.createElement(Welcome, { name: 'Gemini' })
```

生成的 React 元素 type:

type 的值就是 Welcome 这个函数本身。React 在渲染时看到 type 是一个函数（或类），就会去调用（或实例化）它，并把 props 作为参数传入，然后继续渲染该组件返回的结果。

#### 3. Fragment (代码片段)

当你使用 `<>` 或 `<React.Fragment>` 来包裹多个元素而不想添加额外的 DOM 节点时，`type` 会是一个特殊的 **Symbol**。

**示例 JSX:**

JavaScript

```
const element = (
  <>
    <td>你好</td>
    <td>世界</td>
  </>
);
```

**编译后:**

JavaScript

```
// React.createElement(React.Fragment, null, React.createElement('td', ...), React.createElement('td', ...))
```

生成的 React 元素 type:

type 的值就是 React.Fragment 这个特殊的 Symbol (Symbol(react.fragment))。React 看到这个类型，就会只渲染它的子元素，而不会在 DOM 中创建任何父级包裹元素。

### 总结

一张表格清晰地说明了对应关系：

|                   |                  |                               |                                         |
| ----------------- | ---------------- | ----------------------------- | --------------------------------------- |
| **JSX 写法**      | **type 的值**    | **类型**                      | **描述**                                |
| `<div>...</div>`  | `'div'`          | **字符串 (String)**           | 代表要渲染一个 HTML 原生 DOM 节点。     |
| `<MyComponent />` | `MyComponent`    | **函数或类 (Function/Class)** | 代表要渲染一个自定义的 React 组件。     |
| `<>...</>`        | `React.Fragment` | **Symbol**                    | 代表一个不产生额外 DOM 节点的包裹容器。 |
