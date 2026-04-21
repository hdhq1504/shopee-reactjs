# 810ac24 — feat: Lazyload component với React.lazy và Suspense

## Tổng Quan

Commit này áp dụng **Code Splitting** cho toàn bộ page component thông qua `React.lazy` + `Suspense`. Ngoài ra còn tách `QueryConfig` type ra hook riêng để giảm coupling giữa các component.

| File | Thay đổi |
|------|----------|
| `src/useRouteElements.tsx` | Chuyển tất cả import tĩnh → `React.lazy()`, bọc mỗi page bằng `<Suspense>` |
| `src/components/Pagination/Pagination.tsx` | Cập nhật import `QueryConfig` từ hook mới |
| `src/pages/ProductList/components/RatingStars/RatingStars.tsx` | Cập nhật import `QueryConfig` từ hook mới |

---

## Vấn Đề Trước Đó — Bundle Quá Lớn

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

**Hệ quả của static import:** Vite gom code của TẤT CẢ các trang được import tĩnh vào **một file JS duy nhất** khi build:

```
dist/assets/index-BFY8TACo.js   774 kB  ← Tải hết một lần khi vào trang
```

User chỉ vào trang chủ, nhưng browser phải tải toàn bộ 774KB bao gồm code của Cart, Profile, ChangePassword... — những trang chưa cần dùng. Điều này gây **lãng phí bandwidth và làm trang load chậm hơn**, đặc biệt trên mạng chậm hoặc thiết bị yếu.

---

## Giải Pháp — Code Splitting

### Thế nào là Code Splitting?

Thay vì một file JS 774KB, chia nhỏ thành nhiều **chunk** (mảnh) riêng biệt — mỗi chunk chỉ chứa code của một trang:

```
TRƯỚC code splitting:          SAU code splitting:
┌─────────────────────┐        ┌──────────┐  ← chunk chính (~699 kB, chứa thư viện)
│                     │        ├──────────┐  ← Login chunk (~0.87 kB)
│   index.js  774 kB  │   →    ├──────────┐  ← ProductList chunk (~28 kB)
│   (tải hết 1 lần)   │        ├──────────┐  ← Cart chunk
│                     │        └──────────┘  ← ...
└─────────────────────┘
```

Kết quả build sau commit này:
```
dist/assets/index-CEX3sPPz.js          699 kB  ← chunk chính (thư viện bên thứ ba)
dist/assets/index-Ba5TO2JL.js           28 kB  ← ProductList
dist/assets/index-X6EATU7D.js           15 kB  ← ProductDetail
dist/assets/index-COHVrxl5.js           12 kB  ← Profile / ChangePassword
dist/assets/Button-B689f3Wv.js           1 kB  ← shared component
```

Browser tải chunk chính lần đầu, rồi chỉ tải thêm chunk của trang cần thiết khi user điều hướng đến.

---

## Thay Đổi Chi Tiết

### 1. Chuyển Sang `React.lazy()`

```typescript
// TRƯỚC — static import (tải khi app khởi động, dù chưa cần)
import ProductList from '~/pages/ProductList'
import Login from '~/pages/Login'

// SAU — dynamic import với React.lazy (chỉ tải khi lần đầu render)
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

### Tại sao `import()` tạo ra chunk riêng?

**Static import** (`import X from './X'`) — Vite/Webpack thấy đây là dependency tĩnh → gom vào bundle chính.

**Dynamic import** (`import('./X')`) — Vite/Webpack thấy đây là "code cần tải theo yêu cầu" → tạo file chunk riêng cho module đó.

```typescript
// Static import — chạy ngay khi file được parse (trước khi app chạy)
import Login from './pages/Login'         // → code Login nằm trong bundle chính

// Dynamic import — chạy khi được gọi, trả về Promise
import('./pages/Login').then(module => {
  const Login = module.default             // → code Login nằm trong chunk riêng
})

// React.lazy() bọc dynamic import thành React component sử dụng được
const Login = lazy(() => import('./pages/Login'))
```

**`React.lazy(fn)`** nhận một hàm trả về dynamic import và tạo thành một React component. Component đó chỉ thực sự được tải (download chunk, execute code) khi lần đầu tiên được render.

### 2. Bọc Mỗi Page Bằng `<Suspense>`

`React.lazy()` **bắt buộc** phải có `<Suspense>` bao ngoài. Khi component đang được tải về (trình duyệt đang download chunk), Suspense hiển thị fallback UI thay thế:

```tsx
// useRouteElements.tsx — SAU
{
  path: path.login,
  element: (
    <RegisterLayout>
      <Suspense>          {/* Bắt buộc khi dùng lazy() */}
        <Login />
      </Suspense>
    </RegisterLayout>
  )
},
```

**Nếu không có `<Suspense>` → React throw error:**

```
Error: A component suspended while rendering, but no fallback UI was specified.
Add a <Suspense fallback=...> component at the top of your tree.
```

**`<Suspense>` không có prop `fallback` thì sao?**

```tsx
<Suspense>          // fallback mặc định = null (không hiện gì trong lúc tải)
  <Login />
</Suspense>

// Có thể thêm fallback nếu muốn spinner:
<Suspense fallback={<div className='flex justify-center p-8'>Đang tải...</div>}>
  <Login />
</Suspense>
```

Trong commit này dùng `<Suspense>` không có fallback → trong lúc chunk tải về, màn hình giữ nguyên layout bên ngoài (RegisterLayout / MainLayout), phần content trống trong chốc lát.

### 3. Cơ Chế Hoạt Động Bên Trong React.lazy

Khi React render một lazy component lần đầu tiên:

```
React render <Login />  (đây là lazy component)
    ↓
React.lazy phát hiện Login chưa được tải
    ↓
"throw Promise" — React.lazy bên trong throw một Promise
    ↓
<Suspense> bắt Promise → hiển thị fallback (null = không hiện gì)
    ↓
Browser tải Login chunk về (network request đến file chứa code Login)
    ↓
Chunk tải xong → Promise resolve → Login component đã sẵn sàng
    ↓
<Suspense> render lại → <Login /> hiển thị bình thường

Lần sau user vào /login:
    → Chunk đã có trong browser cache → không tải lại → hiển thị ngay
```

### 4. Tại Sao Giữ Layout Ngoài `<Suspense>`?

```tsx
// Cách đúng — Layout bên NGOÀI Suspense
<RegisterLayout>
  <Suspense>
    <Login />         ← Chỉ Login bị ẩn trong lúc tải
  </Suspense>
</RegisterLayout>
// → RegisterLayout hiện ngay, chỉ phần Login trống thoáng qua

// Cách sai — Layout bên TRONG Suspense
<Suspense>
  <RegisterLayout>
    <Login />
  </RegisterLayout>   ← Cả layout biến mất trong lúc tải → layout shift xấu
</Suspense>
```

Đặt layout bên ngoài `<Suspense>` giúp tránh **layout shift** (giao diện nhảy cóc), user thấy layout ổn định trong khi content đang tải.

### 5. Di Chuyển `QueryConfig` Type Về Hook Riêng

Song song với lazy loading, commit này tách `QueryConfig` type ra khỏi `ProductList.tsx`:

```typescript
// TRƯỚC — type nằm trong ProductList component (dependency ngược)
// Pagination.tsx
import type { QueryConfig } from '~/pages/ProductList/ProductList'

// SAU — type nằm trong hook useQueryConfig (đúng chỗ)
// Pagination.tsx
import type { QueryConfig } from '~/hooks/useQueryConfig'
```

**Vấn đề của cách cũ:**

```
Pagination → import type từ ProductList
                  ↑
   Dependency ngược! Component con phụ thuộc vào component cha
   để lấy một type → coupling không cần thiết
```

`Pagination` là component dùng để điều hướng trang — nó không nên biết gì về `ProductList`. Việc import type từ `ProductList` tạo ra liên kết chặt (tight coupling): nếu `ProductList` bị xóa hoặc đổi tên → `Pagination` cũng bị ảnh hưởng dù không liên quan.

**Sau khi tách:**

```typescript
// src/hooks/useQueryConfig.tsx
export type QueryConfig = {           // Export type để các component khác dùng
  [key in keyof ProductListConfig]: string
}

export default function useQueryConfig() {
  const queryParams: QueryConfig = useQueryParams()
  const queryConfig: QueryConfig = omitBy({ page: '1', limit: '20', ... }, isUndefined)
  return queryConfig
}
```

Cả `Pagination` lẫn `ProductList` đều import type từ `useQueryConfig` → không ai phụ thuộc vào nhau. Đây là nguyên tắc **Dependency Inversion**: cả hai phụ thuộc vào abstraction (hook), không phụ thuộc lẫn nhau.

---

## So Sánh Trước/Sau

### Bundle size:

| | Trước | Sau |
|---|---|---|
| Số JS file | 1 file | ~18 file nhỏ |
| File lớn nhất | 774 kB | 699 kB (thư viện bên thứ ba) |
| Chunk trang Login | (trong bundle chính) | ~0.87 kB riêng |
| Chunk ProductList | (trong bundle chính) | ~28 kB riêng |

### Trải nghiệm user:

| | Trước | Sau |
|---|---|---|
| Tải trang đầu tiên | Phải tải hết 774 kB trước khi thấy gì | Chỉ tải chunk cần thiết (699 kB + chunk trang) |
| Chuyển sang trang mới lần đầu | Ngay lập tức (code đã có sẵn) | Nhỏ một tí delay (tải chunk) |
| Chuyển sang trang đã đến | Ngay lập tức | Ngay lập tức (browser cache) |

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Code Splitting** | Kỹ thuật chia bundle JS thành nhiều chunk nhỏ. Mỗi chunk chỉ được tải khi cần. Giúp giảm thời gian tải trang đầu tiên. |
| **`React.lazy(fn)`** | Tạo lazy component từ dynamic import. Component chỉ được tải (download) khi lần đầu tiên được render. Vite/Webpack tự động tạo chunk riêng cho mỗi dynamic import. |
| **Dynamic import `import()`** | Cú pháp JS để load module theo yêu cầu — trả về Promise. Khác với static import chạy ngay khi file được parse. |
| **`<Suspense fallback=...>`** | Bắt buộc bao ngoài lazy component. Hiển thị fallback UI trong khi chunk đang được tải. `fallback` nhận React element tùy ý — có thể là spinner, skeleton... |
| **Route-based Code Splitting** | Pattern phổ biến nhất: mỗi route (page) là một chunk riêng. Hợp lý vì user thường chỉ ghé thăm một số trang nhất định. |
| **Layout ngoài Suspense** | Đặt layout bên ngoài `<Suspense>` để layout hiển thị ngay và ổn định trong khi content đang tải — tránh layout shift. |
| **Centralize type export** | Đặt type vào file sở hữu logic đó (hook `useQueryConfig`) thay vì trong component. Giảm coupling, dễ tái sử dụng, tránh dependency ngược. |
