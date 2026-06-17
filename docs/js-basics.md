# JavaScript 基础教程

## 变量声明

JavaScript 中有三种声明变量的方式：

```javascript
let name = '张三';  // 块级作用域，可重新赋值
const PI = 3.14159; // 常量，不可重新赋值
var old = true;     // 函数作用域（不推荐）
```

## 数据类型

| 类型 | 示例 | typeof |
|------|------|--------|
| 字符串 | `'hello'` | `"string"` |
| 数字 | `42` | `"number"` |
| 布尔值 | `true` | `"boolean"` |
| 对象 | `{ key: 'value' }` | `"object"` |
| 数组 | `[1, 2, 3]` | `"object"` |
| null | `null` | `"object"` |
| undefined | `undefined` | `"undefined"` |

## 常用 ES6+ 特性

### 箭头函数

```javascript
const add = (a, b) => a + b;
```

### 解构赋值

```javascript
const { title, tags } = entry;
const [first, ...rest] = items;
```

### 模板字符串

```javascript
const greeting = `你好, ${name}!`;
```

## 异步编程

### Promise

```javascript
fetch('/api/data')
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));
```

### Async/Await

```javascript
async function loadData() {
  try {
    const res = await fetch('/api/data');
    const data = await res.json();
    return data;
  } catch (error) {
    console.error(error);
  }
}
```

---

> 本文档为入门参考，更多内容请查阅 [MDN Web 文档](https://developer.mozilla.org/zh-CN/)。
