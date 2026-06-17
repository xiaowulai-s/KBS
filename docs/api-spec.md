# API 接口设计规范

## 命名规范

### URL 设计

- 使用名词复数：`/api/users`、`/api/articles`
- 层级不超过三层：`/api/users/{id}/articles`
- 使用连字符而非下划线：`/api/user-profiles`

### HTTP 方法

| 方法 | 用途 | 幂等 |
|------|------|------|
| GET | 查询资源 | 是 |
| POST | 创建资源 | 否 |
| PUT | 全量更新 | 是 |
| PATCH | 部分更新 | 否 |
| DELETE | 删除资源 | 是 |

## 响应格式

### 成功响应

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "title": "示例文档"
  }
}
```

### 分页响应

```json
{
  "code": 200,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### 错误响应

```json
{
  "code": 400,
  "message": "参数验证失败",
  "errors": [
    {
      "field": "title",
      "message": "标题不能为空"
    }
  ]
}
```

## 状态码约定

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

*规范版本: 1.0 | 更新日期: 2026-06-14*
