


#### **核心公式**

`JSX` ➔ `Babel 编译` ➔ `jsx() 函数调用` ➔ `ReactElement 对象`

-----

### **第一部分：处理原生 DOM 标签 (如 `<div>`, `<li>`)**

当我们编写包含原生 HTML 标签的 JSX 时，React 的处理过程相对直接。

**1. JSX 示例**

```jsx
<div id="container">
  <ul>
    <li key="apple">苹果</li>
    <li key="banana">香蕉</li>
  </ul>
</div>
```

**2. Babel 编译结果**

Babel 会将上述 JSX 转换成嵌套的、符合 JavaScript 语法的 `jsx()` 函数调用。

```javascript
jsx(
  "div",
  { id: "container" },
  jsx(
    "ul",
    null,
    jsx("li", { key: "apple" }, "苹果"),
    jsx("li", { key: "banana" }, "香蕉")
  )
);
```

**3. ReactElement 对象树的生成**

当这段 JS 代码在浏览器中执行时，会**从内到外**依次调用 `jsx()` 函数，最终生成一个完整嵌套的 JavaScript 对象，即 `ReactElement` 对象树。

  * **`type` 属性**：对于原生标签，`type` 的值是一个**字符串**，例如 `"div"` 或 `"li"`。
  * **`props` 属性**：一个对象，包含了所有属性（如 `id`）以及一个 `children` 属性，`children` 包含了所有的子元素。

最终生成的对象结构（简化后）如下：

```json
{
  "type": "div",
  "props": {
    "id": "container",
    "children": {
      "type": "ul",
      "props": {
        "children": [
          { "type": "li", "props": { "children": "苹果" }, "key": "apple" },
          { "type": "li", "props": { "children": "香蕉" }, "key": "banana" }
        ]
      }
    }
  }
}
```

这个对象就像一份建筑蓝图，它**描述**了 UI 的结构，但它本身并不是 UI。

-----

### **第二部分：处理函数组件 (如 `<MyComponent />`)**

这部分是理解 React 组件模型的关键。当 JSX 中包含我们自定义的函数组件时，`type` 属性的性质发生了根本改变。

**1. JSX 示例（包含三层嵌套组件）**

```jsx
// 内层
function Child() {
  return <p>我是子组件</p>;
}

// 中层
function Parent() {
  return <div className="parent"><Child /></div>;
}

// 顶层
function Grandparent() {
  return <section><Parent /></section>;
}

// 渲染入口
const app = <Grandparent />;
```

**2. Babel 编译与 ReactElement 生成**

当我们执行 `const app = <Grandparent />` 时：

  * Babel 将其编译为 `jsx(Grandparent, null)`。
  * JS 引擎执行这个函数调用，生成一个**单一且表层的 `ReactElement` 对象**。

这个 `app` 对象的值是：

```json
{
  "$$typeof": Symbol.for('react.element'),
  "type": Grandparent, // 关键：type 是对 Grandparent 函数本身的引用！
  "key": null,
  "ref": null,
  "props": {}
}
```

**核心要点**：
在这个阶段，`Grandparent` 函数**完全没有被执行**。React 只是创建了一个“待办事项”，记录下“这里有一个类型为 `Grandparent` 函数的组件需要被渲染”。它对 `Parent` 和 `Child` 的存在一无所知。

### **第三部分：渲染阶段的“递归展开”**

`ReactElement` 对象树创建好后，会被交给 React 的渲染器（如 `ReactDOM`），这时才开始真正的渲染工作。这个过程对于函数组件来说，是一个**递归调用和展开**的过程。

1.  **React 检查 `app` 对象**：它看到 `type` 是一个函数 `Grandparent`。
2.  **调用函数**：React 渲染器调用 `Grandparent()`。
3.  **获取下一层 Element**：`Grandparent` 函数执行后，返回 `<Parent />` 对应的 `ReactElement`。
4.  **React 检查新 Element**：它看到新的 `type` 仍然是一个函数 `Parent`。
5.  **继续调用**：React 渲染器接着调用 `Parent()`，得到 `<Child />` 对应的 `ReactElement`。
6.  **再次调用**：React 渲染器继续调用 `Child()`，最终得到 `<p>...</p>` 对应的 `ReactElement`。
7.  **触达原生 DOM**：此时，React 终于看到了一个 `type` 为字符串 `'p'` 的元素。它知道这是递归的终点，于是创建了一个真实的 `<p>` DOM 节点。
8.  **构建 DOM 树**：React 将创建好的 `<p>` 节点，按照之前展开的路径，依次挂载到 `<div>` 和 `<section>` 节点中，最终完成整个 DOM 树的构建。

### **总结与流程图**

1.  **Element 创建是“浅”的**：`jsx()` 函数的执行只会创建当前层的 `ReactElement`，不会深入执行组件内部的逻辑。它只关心 `type` 是字符串还是函数。
2.  **渲染过程是“深”的**：React 渲染器通过递归调用 `type` 为函数的组件，像剥洋葱一样，层层深入，直到找到所有 `type` 为字符串的原生标签，才开始创建真实 DOM。
3.  **`type` 属性是关键开关**：
      * `type: 'string'` ➔ 渲染原生 DOM 节点。
      * `type: Function` ➔ 调用该函数，然后对其返回值进行下一轮渲染。


