# 9e3155c & 1dbd01c — feat: Thêm 404 Page + ErrorBoundary

## 🎯 Tổng Quan

Hai commit liên tiếp xử lý **2 loại lỗi** mà mọi ứng dụng cần có:

| Commit | Tính năng | Xử lý lỗi gì |
|--------|-----------|--------------|
| `9e3155c` | Trang **404 Not Found** | URL không tồn tại |
| `1dbd01c` | Component **ErrorBoundary** | JavaScript crash trong React component tree |

**File thay đổi:**

| File | Thay đổi |
|------|----------|
| `src/pages/NotFound/NotFound.tsx` | Tạo mới — UI trang 404 |
| `src/pages/NotFound/index.ts` | Tạo mới — barrel export |
| `src/components/ErrorBoundary/ErrorBoundary.tsx` | Tạo mới — Class component bắt lỗi runtime |
| `src/components/ErrorBoundary/index.ts` | Tạo mới — barrel export |
| `src/useRouteElements.tsx` | Thêm route `path: '*'` → `<NotFound />` |
| `src/main.tsx` | Bọc `<App />` bằng `<ErrorBoundary>` |

---

## 📋 Commit 1 — Trang 404 Not Found (`9e3155c`)

### Vấn đề trước đó

Khi user truy cập URL không tồn tại (ví dụ `/abc`, `/xyz`), React Router không match được route nào → trang trắng hoặc crash.

### Giải pháp: Route wildcard `path: '*'`

```typescript
// src/useRouteElements.tsx
{
  path: '*',          // ← '*' = khớp MỌI URL không match route nào ở trên
  element: (
    <MainLayout>
      <NotFound />
    </MainLayout>
  )
}
```

**React Router xử lý route theo thứ tự ưu tiên:**

```
URL: /user/profile  → match /user → render Profile ✅
URL: /cart          → match /cart → render Cart ✅
URL: /abc123        → không match gì → fallback vào path: '*' → render NotFound ✅
URL: /login         → match /login → render Login ✅ (không bao giờ xuống '*')
```

> **Quan trọng:** `path: '*'` chỉ được kích hoạt khi **không có route nào ở trên** match. Nó phải đặt **cuối cùng** trong mảng routes để hoạt động đúng.

### UI Trang 404

```tsx
// src/pages/NotFound/NotFound.tsx
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className='flex h-screen w-full flex-col items-center justify-center'>
      <h1 className='text-9xl font-extrabold tracking-widest text-gray-900'>404</h1>
      <div className='bg-orange absolute rotate-12 rounded px-2 text-sm text-white'>
        Page Not Found
      </div>
      <button className='mt-5'>
        <Link
          to='/'
          className='group relative inline-block text-sm font-medium text-white ...'
        >
          {/* Hiệu ứng shadow lệch → về 0 khi hover */}
          <span className='bg-orange absolute inset-0 translate-x-0.5 translate-y-0.5
                           transition-transform group-hover:translate-x-0 group-hover:translate-y-0' />
          <span className='relative block border border-current px-8 py-3'>
            <span>Go Home</span>
          </span>
        </Link>
      </button>
    </main>
  )
}
```

**Kỹ thuật CSS đáng chú ý — Hiệu ứng "shadow lệch":**

```
Trạng thái bình thường:        Khi hover:
┌──────────────────┐          ┌──────────────────┐
│                  │  ←cam→  │    Go Home       │
│    Go Home       │          └──────────────────┘
└──────────────────┘
      ↘ (shadow cam lệch 0.5px)
```

```tsx
// 2 lớp span chồng lên nhau:
<span className='bg-orange absolute inset-0
                  translate-x-0.5 translate-y-0.5       // Lớp cam: lệch ra 2px
                  transition-transform
                  group-hover:translate-x-0             // Hover: về đúng vị trí
                  group-hover:translate-y-0' />

<span className='relative block border border-current px-8 py-3'>
  Go Home                                               // Lớp text: border trắng
</span>
```

**`group` / `group-hover`** — Kỹ thuật Tailwind: đặt `group` ở element cha, dùng `group-hover:` ở element con để thay đổi style khi cha được hover:

```tsx
<Link className='group ...'>          {/* ← cha có class 'group' */}
  <span className='group-hover:translate-x-0' />  {/* ← con phản ứng khi cha hover */}
</Link>
```

---

## 📋 Commit 2 — ErrorBoundary (`1dbd01c`)

### Vấn đề ErrorBoundary giải quyết

Trong React, nếu một component **throw error trong lúc render** → toàn bộ cây component bị unmount → màn hình trắng tinh, user không biết phải làm gì:

```
App
 └── BrowserRouter
      └── MainLayout
           └── ProductList
                └── ProductCard  ← throw Error("Cannot read property 'price' of undefined")
                                    → Toàn bộ màn hình TRẮNG ❌
```

**ErrorBoundary** bắt lỗi này và hiển thị UI fallback thay thế (trang 500).

---

### Tại Sao Phải Dùng Class Component?

`ErrorBoundary` **bắt buộc** phải là **class component** vì nó dùng 2 lifecycle method chỉ có ở class:

| Lifecycle | Khi nào chạy | Dùng để |
|-----------|-------------|---------|
| `static getDerivedStateFromError` | Ngay khi child throw error | Cập nhật state để trigger re-render với UI fallback |
| `componentDidCatch` | Sau khi error được "bắt" | Log lỗi ra console / gửi lên error tracking service |

> ⚠️ Tính đến hiện tại, React chưa cung cấp hook tương đương cho hai method này. Đây là lý do duy nhất dự án này dùng class component.

---

### Giải Thích Code ErrorBoundary

```tsx
// src/components/ErrorBoundary/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children?: ReactNode   // Nội dung bọc bên trong
}

interface State {
  hasError: boolean      // true = đang hiển thị UI lỗi
}

export default class ErrorBoundary extends Component<Props, State> {
  // Trạng thái ban đầu: chưa có lỗi
  public state: State = {
    hasError: false
  }

  // 1. Chạy ngay khi có error trong cây con
  //    → Static method, không có `this`, trả về state mới
  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true }   // Trigger re-render với hasError = true
  }

  // 2. Chạy sau khi error đã được bắt
  //    → Dùng để log lỗi (console, Sentry, DataDog, ...)
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error: ', error, errorInfo)
    // errorInfo.componentStack = stack trace của component gây lỗi
  }

  public render() {
    if (this.state.hasError) {
      // Hiển thị trang lỗi 500 thay vì crash trắng
      return (
        <main className='flex h-screen w-full flex-col items-center justify-center'>
          <h1 className='text-9xl font-extrabold ...'>500</h1>
          <div className='bg-orange ...'>Error!</div>
          <button className='mt-5'>
            {/* Dùng <a> thay vì <Link> — vì router context có thể đã bị lỗi */}
            <a href='/'>Go Home</a>
          </button>
        </main>
      )
    }

    // Bình thường → render children như không có gì
    return this.props.children
  }
}
```

**Tại sao dùng `<a href='/'>` thay vì `<Link to='/'>`?**

Khi JavaScript crash, bản thân React Router context có thể đã bị hỏng. `<Link>` cần React Router context để hoạt động → có thể crash tiếp. `<a href='/'>` là HTML thuần → luôn hoạt động, thực hiện full page reload về trang chủ.

---

### Đăng Ký ErrorBoundary Ở Gốc App

```tsx
// src/main.tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <ErrorBoundary>      {/* ← Bọc ngoài toàn bộ <App /> */}
            <App />
          </ErrorBoundary>
        </AppProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
)
```

**Vị trí đặt `<ErrorBoundary>` rất quan trọng:**

```
StrictMode
 └── BrowserRouter
      └── QueryClientProvider
           └── AppProvider
                └── ErrorBoundary  ← bọc ở đây
                     └── App       ← bắt lỗi từ toàn bộ cây này
```

- Đặt **trong** `<AppProvider>` → ErrorBoundary vẫn có thể dùng `AppContext` nếu cần
- Đặt **bên ngoài** `<ReactQueryDevtools>` → Devtools không bị ảnh hưởng khi crash

---

## 🔄 So Sánh 404 vs 500

| | 404 Not Found | 500 Internal Error |
|---|---|---|
| **Nguyên nhân** | URL không tồn tại | JavaScript crash trong component |
| **Khi nào xảy ra** | User gõ URL sai | Runtime error (null reference, API trả data sai shape, ...) |
| **Cách xử lý** | Route `path: '*'` trong React Router | `ErrorBoundary` class component |
| **Navigation** | `<Link to='/'>` (React Router) | `<a href='/'>` (HTML thuần — vì router có thể bị hỏng) |
| **Mã lỗi** | 404 | 500 |

---

## 🔄 Luồng Hoạt Động

```
Kịch bản 1 — URL không tồn tại:
User gõ /abc
    ↓
React Router duyệt qua tất cả routes
    ↓
Không match route nào → khớp path: '*'
    ↓
Render <MainLayout><NotFound /></MainLayout>
    ↓
User thấy trang 404, có nút "Go Home"

─────────────────────────────────────────

Kịch bản 2 — JavaScript crash:
Component throw Error trong lúc render
    ↓
React "bubbles" error lên cây component
    ↓
ErrorBoundary.getDerivedStateFromError() chạy
    → setState({ hasError: true })
    ↓
ErrorBoundary.componentDidCatch() chạy
    → console.error(...)
    ↓
ErrorBoundary re-render với hasError = true
    → hiển thị trang 500
    ↓
User thấy trang 500, có nút "Go Home" (full reload)
```

---

## 📌 Kiến Thức Mới Trong 2 Commit Này

| Khái niệm | Giải thích |
|-----------|-----------|
| **`path: '*'`** | Wildcard route — khớp mọi URL không match route nào khác; phải đặt cuối cùng |
| **ErrorBoundary** | Class component bắt lỗi JavaScript từ cây con — thay màn hình trắng bằng UI fallback |
| **`getDerivedStateFromError`** | Static lifecycle — chạy khi child throw error, trả về state mới để trigger re-render fallback UI |
| **`componentDidCatch`** | Lifecycle — chạy sau khi error được bắt, dùng để log lỗi |
| **`<a>` vs `<Link>`** | Trong ErrorBoundary dùng `<a href>` vì React Router context có thể đã crash |
| **`group` / `group-hover:`** | Tailwind pattern: style element con khi element cha được hover |
| **Barrel export (`index.ts`)** | File trung gian `export { default } from './Component'` — cho phép import gọn: `import X from '~/components/X'` thay vì `import X from '~/components/X/X'` |
