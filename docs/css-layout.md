# CSS 布局技巧汇总

## Flexbox 布局

### 水平垂直居中

```css
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
```

### 弹性子项排列

```css
.flex-row {
  display: flex;
  flex-direction: row;
  gap: 16px;
}

.flex-column {
  display: flex;
  flex-direction: column;
}
```

## Grid 布局

### 自适应网格

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
```

### 经典圣杯布局

```css
.holy-grail {
  display: grid;
  grid-template-areas:
    'header  header'
    'sidebar main'
    'footer  footer';
  grid-template-columns: 250px 1fr;
  min-height: 100vh;
}
```

## 响应式设计

### 媒体查询

```css
@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
```

### 容器查询（新）

```css
.card-container {
  container-type: inline-size;
}

@container (max-width: 400px) {
  .card {
    flex-direction: column;
  }
}
```

## 实用技巧

1. **清除浮动**：使用 `display: flow-root` 替代 clearfix
2. **最小高度**：使用 `min-height: 100vh` 确保全屏
3. **文字溢出**：使用 `overflow: hidden; text-overflow: ellipsis`
4. **平滑滚动**：`scroll-behavior: smooth`

---

*最后更新: 2026-06-17*
