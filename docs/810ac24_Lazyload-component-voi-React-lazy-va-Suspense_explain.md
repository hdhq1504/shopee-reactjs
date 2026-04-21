# 810ac24 — feat: Lazyload component với React.lazy và Suspense

## 🎯 Tổng Quan

Commit này áp dụng **Code Splitting** cho toàn bộ page component thông qua `React.lazy` + `Suspense`. Ngoài ra còn tách `QueryConfig` type ra hook riêng.

| File | Thay đổi |
|------|----------|
| `src/useRouteElements.tsx` | Chuyển tất cả `import` tĩnh → `React.lazy()`, bọc mỗi page bằng `<Suspense>` |
| `src/components/Pagination/Pagination.tsx` | Cập nhật import `QueryConfig` từ hook mới |
| `src/pages/ProductList/components/RatingStars/RatingStars.tsx` | Cập nhật import `QueryConfig` từ hook mới |

---

## 📋 Vấn Đề Trước Đó — Bundle Quá Lớn

Trước commit này, tất cả page được import **tĩnh** (static import) ở đầu file:

```typescript
// useRouteElements.tsx — TRƯỚC
import ProductList from '~/pages/ProductList'
import Login from '~/pages/Login'
import Register from '~/pages/Register'
import ProductDetail from '~/pages/ProductDetail'
import Cart from '~/pages/Cart'
import Profile from '~/pages/User/pages/Profile'
import ChangePassword from '~/pages/User/pages/ChangePassword'
import HistoryPurchase from '~/pages/User/pages/HistoryPurchase'
import NotFound from '~/pages/NotFound'
```

**Hệ quả:** Khi build, Vite gom tất cả vào **một file JS duy nhất**:

```
dist/assets/index-BFY8TACo.js   774 kB  ← Tải hết một lần khi vào trang
```

Dù user chỉ vào trang chủ, browser vẫn phải tải code của `Cart`, `Profile`, `ChangePassword`... — những trang chưa cần dùng → **lãng phí bandwidth, trang load chậm hơn**.

---

## 📋 Giải Pháp — Code Splitting

### Thế nào là Code Splitting?

Thay vì 1 file JS khổng lồ, chia nhỏ thành nhiều **chunk** (mảnh) riêng biệt:

```
TRƯỚC code splitting:          SAU code splitting:
┌─────────────────────┐        ┌──────────┐  ← chunk chính (~230 kB)
│                     │        ├──────────┐  ← Login chunk
│   index.js  774 kB  │   →    ├──────────┐  ← Cart chunk
│   (tải hết 1 lần)   │        ├──────────┐  ← Profile chunk
│                     │        └──────────┘  ← ...
└─────────────────────┘
                               Chỉ tải chunk cần thiết cho trang hiện tại!
```

Kết quả build sau commit này:
```
dist/assets/index-CEX3sPPz.js          699 kB  ← chunk chính (thư viện)
dist/assets/index-Ba5TO2JL.js           28 kB  ← ProductList
dist/assets/index-X6EATU7D.js           15 kB  ← ProductDetail
dist/assets/index-COHVrxl5.js           12 kB  ← Profile / ChangePassword
dist/assets/Button-B689f3Wv.js           1 kB  ← shared component
...
```

---

## 📁 Thay Đổi Chi Tiết

### 1. Chuyển Sang `React.lazy()`

```typescript
// TRƯỚC — static import (tải khi app khởi động)
import ProductList from '~/pages/ProductList'
import Login from '~/pages/Login'
// ...

// SAU — dynamic import với React.lazy (chỉ tải khi cần)
const Login = lazy(() => import('./pages/Login'))
const ProductList = lazy(() => import('./pages/ProductList'))
const Profile = lazy(() => import('./pages/User/pages/Profile'))
const Register = lazy(() => import('./pages/Register'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Cart = lazy(() => import('./pages/Cart'))
const ChangePassword = lazy(() => import('./pages/User/pages/ChangePassword'))
const HistoryPurchase = lazy(() => import('./pages/User/pages/HistoryPurchase'))
const NotFound = lazy(() => import('./pages/NotFound'))
```

**`React.lazy()`** nhận vào một hàm trả về **dynamic import** (`import()`):

```typescript
const Login = lazy(() => import('./pages/Login'))
//     ↑                   ↑
//     Biến React component  Hàm trả về Promise<Module>
//     (nhưng load lazily)   → Chỉ tải file khi component này lần đầu được render
```

**Sự khác biệt giữa static và dynamic import:**

```typescript
// Static import — chạy ngay khi file được parse (trước khi app chạy)
import Login from './pages/Login'

// Dynamic import — chạy khi được gọi, trả về Promise
import('./pages/Login').then(module => {
  const Login = module.default
})

// React.lazy() bọc dynamic import lại thành React component
const Login = lazy(() => import('./pages/Login'))
```

---

### 2. Bọc Mỗi Page Bằng `<Suspense>`

`React.lazy()` **bắt buộc** phải có `<Suspense>` bao ngoài. Khi component đang được tải về (network request), Suspense hiển thị fallback:

```tsx
// useRouteElements.tsx — SAU
{
  path: path.login,
  element: (
    <RegisterLayout>
      <Suspense>          {/* ← Bắt buộc khi dùng lazy() */}
        <Login />
      </Suspense>
    </RegisterLayout>
  )
},
```

**Nếu không có `<Suspense>` → React sẽ throw error:**

```
Error: A component suspended while rendering, but no fallback UI was specified.
Add a <Suspense fallback=...> component at the top of your tree.
```

**`<Suspense>` không có prop `fallback` thì sao?**

```tsx
<Suspense>          // ← fallback mặc định = null (không hiển thị gì trong lúc tải)
  <Login />
</Suspense>

// Có thể thêm fallback nếu muốn hiển thị spinner:
<Suspense fallback={<div>Đang tải...</div>}>
  <Login />
</Suspense>
```

Trong commit này dùng `<Suspense>` không có fallback → trong lúc chunk tải về, màn hình hiển thị trống (giữ layout của `RegisterLayout` / `MainLayout` bên ngoài).

---

### 3. Cơ Chế Hoạt Động Bên Trong

```
Lần đầu user vào /login:

Browser tải app
    ↓
React render <RegisterLayout><Suspense><Login /></Suspense></RegisterLayout>
    ↓
React.lazy phát hiện Login chưa được tải
    ↓
"throw Promise" ← đây là cơ chế nội bộ của React
    ↓
<Suspense> bắt Promise → hiển thị fallback (null = không hiện gì)
    ↓
Browser tải Login chunk về (network request)
    ↓
Chunk tải xong → Promise resolve
    ↓
<Suspense> render lại → <Login /> hiển thị bình thường ✅

Lần sau user vào /login:
    → Chunk đã có trong browser cache → không tải lại → hiển thị ngay ✅
```

---

### 4. Tại Sao Giữ Layout Ngoài `<Suspense>`?

```tsx
// ✅ Layout bên NGOÀI Suspense — layout hiển thị ngay, chỉ content bên trong loading
<RegisterLayout>
  <Suspense>
    <Login />
  </Suspense>
</RegisterLayout>

// ❌ Layout bên TRONG Suspense — cả layout cũng biến mất trong lúc loading
<Suspense>
  <RegisterLayout>
    <Login />
  </RegisterLayout>
</Suspense>
```

Để tránh "layout shift" (giao diện nhảy loạn khi tải), chỉ cho phần **content thay đổi** vào Suspense, giữ layout ổn định bên ngoài.

---

### 5. Di Chuyển `QueryConfig` Type Về Hook Riêng

Song song với lazy loading, commit này cũng tách `QueryConfig` ra khỏi `ProductList.tsx`:

```typescript
// TRƯỚC — type nằm trong ProductList component (không đúng chỗ)
// Pagination.tsx
import type { QueryConfig } from '~/pages/ProductList/ProductList'
// RatingStars.tsx
import type { QueryConfig } from '~/pages/ProductList/ProductList'

// SAU — type nằm trong hook useQueryConfig (đúng chỗ hơn)
// Pagination.tsx
import type { QueryConfig } from '~/hooks/useQueryConfig'
// RatingStars.tsx
import type { QueryConfig } from '~/hooks/useQueryConfig'
```

**Tại sao cần thay đổi này?**

```
TRƯỚC: Pagination → import type từ ProductList
                    ↑
         Dependency ngược! Component con phụ thuộc vào component cha
         để lấy một type → coupling không cần thiết

SAU:   Pagination → import type từ hooks/useQueryConfig
       ProductList → import type từ hooks/useQueryConfig
                    ↑
         Cả hai cùng import từ nguồn trung tâm → giảm coupling
```

`useQueryConfig.tsx` export cả type lẫn logic:

```typescript
// src/hooks/useQueryConfig.tsx
export type QueryConfig = {          // ← export type để dùng chung
  [key in keyof ProductListConfig]: string
}

export default function useQueryConfig() {
  const queryParams: QueryConfig = useQueryParams()
  const queryConfig: QueryConfig = omitBy({ page: '1', limit: '20', ... }, isUndefined)
  return queryConfig
}
```

---

## 🔄 So Sánh Trước/Sau

### Bundle size:

| | Trước | Sau |
|---|---|---|
| Số JS file | 1 file | ~18 file nhỏ |
| File lớn nhất | 774 kB | 699 kB (thư viện) |
| Chunk trang Login | (trong bundle chính) | ~0.87 kB riêng |
| Chunk ProductList | (trong bundle chính) | ~28 kB riêng |

### Trải nghiệm user:

| | Trước | Sau |
|---|---|---|
| Tải trang đầu tiên | Tải hết 774 kB | Chỉ tải chunk cần thiết |
| Chuyển trang lần đầu | Nhanh (đã có sẵn) | Nhỏ delay (tải chunk) |
| Chuyển trang lần sau | Nhanh | Nhanh (cache) |

---

## 📌 Kiến Thức Mới Trong Commit Này

| Khái niệm | Giải thích |
|-----------|-----------|
| **Code Splitting** | Kỹ thuật chia bundle JS thành nhiều chunk nhỏ — mỗi chunk chỉ được tải khi cần |
| **`React.lazy(fn)`** | Tạo lazy component từ dynamic import — component chỉ được tải khi lần đầu render |
| **Dynamic import `import()`** | Cú pháp JS load module theo yêu cầu — trả về Promise, Vite/Webpack tự tạo chunk riêng cho mỗi dynamic import |
| **`<Suspense fallback=...>`** | Bắt buộc bao ngoài lazy component — hiển thị fallback trong khi chunk đang được tải |
| **Route-based code splitting** | Pattern phổ biến nhất: mỗi route (page) là một chunk riêng — phù hợp vì user thường chỉ dùng một số trang |
| **Layout ngoài Suspense** | Đặt layout bên ngoài `<Suspense>` để tránh layout shift khi chunk đang load |
| **Centralize type export** | Đặt type vào nơi "sở hữu" logic đó (hook) thay vì trong component — giảm coupling, dễ tái sử dụng |
