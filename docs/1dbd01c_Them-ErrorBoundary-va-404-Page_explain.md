# 1dbd01c — feat: Thêm ErrorBoundary và 404 Page

## Tổng Quan

Hai commit liên tiếp xử lý **2 loại lỗi** mà mọi ứng dụng web cần có:

| Commit | Tính năng | Xử lý lỗi gì |
|--------|-----------|--------------|
| `9e3155c` | Trang **404 Not Found** | URL không tồn tại |
| `1dbd01c` | Component **ErrorBoundary** | JavaScript crash trong React component tree |

**Files thay đổi:**

| File | Thay đổi |
|------|----------|
| `src/pages/NotFound/NotFound.tsx` | Tạo mới — UI trang 404 |
| `src/pages/NotFound/index.ts` | Tạo mới — barrel export |
| `src/components/ErrorBoundary/ErrorBoundary.tsx` | Tạo mới — Class component bắt lỗi runtime |
| `src/components/ErrorBoundary/index.ts` | Tạo mới — barrel export |
| `src/useRouteElements.tsx` | Thêm route `path: '*'` → `<NotFound />` |
| `src/main.tsx` | Bọc `<App />` bằng `<ErrorBoundary>` |

---

## Commit 1 — Trang 404 Not Found (`9e3155c`)

### Vấn đề trước đó

Khi user gõ URL không tồn tại (ví dụ `/abc`, `/xyz/123`), React Router duyệt qua toàn bộ danh sách route nhưng không khớp được bất kỳ route nào → trang trắng hoặc crash, không có thông báo gì cho user.

### Giải pháp: Route wildcard `path: '*'`

```typescript
// src/useRouteElements.tsx
{
  path: '*',          // '*' = khớp MỌI URL không match route nào ở trên
  element: (
    <MainLayout>
      <NotFound />
    </MainLayout>
  )
}
```

React Router xử lý route theo **thứ tự ưu tiên từ trên xuống dưới**. Route `path: '*'` chỉ được kích hoạt khi **không có route nào phía trên** match. Vì vậy nó phải được đặt **cuối cùng** trong mảng routes:

```
URL: /user/profile → khớp /user/profile → render Profile ✅
URL: /cart         → khớp /cart         → render Cart ✅
URL: /abc123       → không khớp gì      → fallback vào path: '*' → render NotFound ✅
```

Nếu đặt `path: '*'` lên đầu, nó sẽ bắt mọi URL và không có trang nào khác hiển thị được.

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
          {/* Hiệu ứng shadow lệch → trở về vị trí ban đầu khi hover */}
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

### Kỹ thuật CSS — Hiệu ứng "shadow lệch"

Nút "Go Home" có 2 lớp span chồng lên nhau:

```
Trạng thái bình thường:     Khi hover:
┌──────────────────┐        ┌──────────────────┐
│    Go Home       │        │    Go Home       │
└──────────────────┘        └──────────────────┘
      ↘ shadow cam lệch 2px   (shadow gộp vào nút chính)
```

```tsx
// Lớp 1 (cam): tạo hiệu ứng shadow
<span className='bg-orange absolute inset-0
                  translate-x-0.5 translate-y-0.5       // Lệch ra 2px khi bình thường
                  transition-transform
                  group-hover:translate-x-0             // Về đúng vị trí khi hover
                  group-hover:translate-y-0' />

// Lớp 2 (text): border trắng
<span className='relative block border border-current px-8 py-3'>
  Go Home
</span>
```

**`group` / `group-hover:` — Tailwind pattern quan trọng:**

Khi muốn style của element con thay đổi dựa trên hover của element cha, đặt class `group` ở cha và dùng `group-hover:` ở con:

```tsx
<Link className='group ...'>           {/* Cha có class 'group' */}
  <span className='group-hover:translate-x-0' />  {/* Con phản ứng khi cha hover */}
</Link>
```

---

## Commit 2 — ErrorBoundary (`1dbd01c`)

### Vấn đề ErrorBoundary giải quyết

Trong React, khi một component **throw error trong lúc render**, React sẽ unmount toàn bộ cây component từ điểm đó trở lên → màn hình trắng tinh, user không biết chuyện gì xảy ra:

```
App
 └── BrowserRouter
      └── MainLayout
           └── ProductList
                └── ProductCard  ← throw Error("Cannot read property 'price' of undefined")
                                    → Toàn bộ màn hình TRẮNG
```

**ErrorBoundary** bắt những lỗi này và hiển thị UI fallback (trang 500) thay vì crash trắng.

### Tại sao bắt buộc phải dùng Class Component?

`ErrorBoundary` **bắt buộc** phải là **class component** vì nó cần 2 lifecycle method mà React chưa cung cấp hook tương đương:

| Lifecycle | Khi nào chạy | Dùng để |
|-----------|-------------|---------|
| `static getDerivedStateFromError` | Ngay khi child throw error | Cập nhật state để trigger re-render với UI fallback |
| `componentDidCatch` | Sau khi error đã được bắt | Log lỗi ra console hoặc gửi lên error tracking service (Sentry, Datadog...) |

Đây là lý do duy nhất project này dùng class component — tất cả nơi khác đều dùng functional component.

### Giải Thích Code ErrorBoundary

```tsx
// src/components/ErrorBoundary/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children?: ReactNode   // Nội dung bọc bên trong
}

interface State {
  hasError: boolean      // true = đang hiển thị UI lỗi thay vì children
}

export default class ErrorBoundary extends Component<Props, State> {
  // Trạng thái ban đầu: chưa có lỗi
  public state: State = {
    hasError: false
  }

  // Bước 1: Chạy ngay khi có error trong cây con
  // Static method → không có `this` → chỉ trả về state mới để trigger re-render
  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true }
  }

  // Bước 2: Chạy sau khi error đã được bắt
  // Instance method → có `this` → dùng để log hoặc gửi error lên monitoring service
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error: ', error, errorInfo)
    // errorInfo.componentStack = chuỗi cho thấy component nào gây ra lỗi
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

    // Bình thường → render children như không có gì xảy ra
    return this.props.children
  }
}
```

### Tại sao dùng `<a href='/'>` thay vì `<Link to='/'>` trong ErrorBoundary?

Khi JavaScript crash đủ mạnh, bản thân React Router context có thể đã bị hỏng. `<Link>` phụ thuộc vào React Router context để work — nếu context bị hỏng thì `<Link>` cũng crash theo, ta vào vòng lặp crash vô tận.

`<a href='/'>` là HTML thuần, không phụ thuộc vào React hay React Router. Trình duyệt xử lý nó trực tiếp, thực hiện full page reload về trang chủ — luôn hoạt động dù JavaScript có bị lỗi thế nào.

### Đăng Ký ErrorBoundary Ở Gốc App

```tsx
// src/main.tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <ErrorBoundary>      {/* Bọc ngoài toàn bộ <App /> */}
            <App />
          </ErrorBoundary>
        </AppProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
)
```

**Vị trí đặt `<ErrorBoundary>` quan trọng:**

Đặt **bên trong** `<AppProvider>` → ErrorBoundary có thể dùng `AppContext` nếu UI fallback cần thông tin về user (tên, avatar...).

Đặt **bên ngoài** `<ReactQueryDevtools>` → Devtools không bị ảnh hưởng khi app crash, vẫn có thể debug.

---

## So Sánh 404 vs 500

| | 404 Not Found | 500 Internal Error |
|---|---|---|
| **Nguyên nhân** | URL không tồn tại | JavaScript crash trong component |
| **Khi nào xảy ra** | User gõ URL sai | Runtime error (null reference, API trả data sai...) |
| **Cách xử lý** | Route `path: '*'` trong React Router | `ErrorBoundary` class component |
| **Navigation** | `<Link to='/'>` (React Router) | `<a href='/'>` (HTML thuần — vì router có thể bị hỏng) |
| **HTTP Code** | 404 | 500 |

---

## Luồng Hoạt Động

```
Kịch bản 1 — URL không tồn tại:

User gõ /abc123
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
    → Hiển thị trang 500
    ↓
User thấy trang 500, có nút "Go Home" (full reload)
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **`path: '*'`** | Wildcard route — khớp mọi URL không match route nào khác. Phải đặt cuối cùng trong mảng routes để không bắt nhầm các URL hợp lệ. |
| **ErrorBoundary** | Class component bắt lỗi JavaScript từ cây con trong lúc render. Thay thế màn hình trắng khó hiểu bằng UI fallback thân thiện. |
| **`getDerivedStateFromError`** | Static lifecycle method, chạy ngay khi child throw error. Trả về state mới để trigger re-render hiển thị fallback UI. Không có `this`. |
| **`componentDidCatch`** | Instance lifecycle method, chạy sau khi error được bắt. Dùng để log hoặc gửi error lên monitoring service (Sentry, Datadog...). Có `this`. |
| **`<a>` vs `<Link>`** | Trong ErrorBoundary dùng `<a href>` vì `<Link>` cần React Router context — context có thể đã crash. `<a>` là HTML thuần, luôn hoạt động. |
| **`group` / `group-hover:`** | Tailwind pattern: đặt `group` ở element cha, dùng `group-hover:` ở element con để style con thay đổi khi cha được hover. |
| **Barrel export (`index.ts`)** | File trung gian chỉ chứa `export { default } from './Component'`. Cho phép import gọn: `from '~/components/ErrorBoundary'` thay vì `from '~/components/ErrorBoundary/ErrorBoundary'`. |
