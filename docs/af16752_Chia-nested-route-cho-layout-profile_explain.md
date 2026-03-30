# af16752 — feat: Chia nested route cho layout profile

## 🎯 Tổng Quan

Commit này thiết lập **cấu trúc Nested Routes** cho các trang quản lý tài khoản cá nhân (Profile, Đổi mật khẩu, Lịch sử mua hàng). Đây là bước **dựng khung sườn (scaffolding)** — các component chưa có UI chi tiết, chỉ là placeholder.

**Mục tiêu kiến trúc:**

```
URL: /user/profile            URL: /user/password           URL: /user/purchase
┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
│ Header                  │   │ Header                  │   │ Header                  │
├──────┬──────────────────┤   ├──────┬──────────────────┤   ├──────┬──────────────────┤
│ Side │                  │   │ Side │                  │   │ Side │                  │
│ Nav  │ Profile Content  │   │ Nav  │ ChangePassword   │   │ Nav  │ HistoryPurchase  │
│      │                  │   │      │ Content          │   │      │ Content          │
│      │                  │   │      │                  │   │      │                  │
├──────┴──────────────────┤   ├──────┴──────────────────┤   ├──────┴──────────────────┤
│ Footer                  │   │ Footer                  │   │ Footer                  │
└─────────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
          ↑                             ↑                             ↑
   Header, Footer, SideNav GIỐNG NHAU — chỉ phần content thay đổi theo URL
```

---

## 📁 Tổng Quan Các File Thay Đổi

### Files mới tạo:

| File | Loại | Vai trò |
|------|------|---------|
| `src/pages/User/components/UserSideNav/UserSideNav.tsx` | Component | Thanh menu bên trái (placeholder) |
| `src/pages/User/layouts/UserLayout/UserLayout.tsx` | Layout | Layout lồng: SideNav + `<Outlet />` |
| `src/pages/User/pages/Profile/Profile.tsx` | Page | Trang thông tin cá nhân (placeholder) |
| `src/pages/User/pages/ChangePassword/ChangePassword.tsx` | Page | Trang đổi mật khẩu (placeholder) |
| `src/pages/User/pages/HistoryPurchase/HistoryPurchase.tsx` | Page | Trang lịch sử mua hàng (placeholder) |
| Các file `index.ts` tương ứng | Barrel export | Re-export component cho import gọn |

### Files sửa:

| File | Thay đổi |
|------|----------|
| `src/constants/path.ts` | Thêm routes `/user`, `/user/profile`, `/user/password`, `/user/purchase` |
| `src/useRouteElements.tsx` | Cấu hình nested routes cho nhóm User |

---

## 📁 1. `src/constants/path.ts` — Định Nghĩa Routes Mới

```typescript
const path = {
  home: '/',
  user: '/user',                     // ← MỚI: Route cha cho nhóm User
  profile: '/user/profile',          // ← SỬA: Trước là '/profile'
  changePassword: '/user/password',  // ← MỚI
  hitoryPurchase: '/user/purchase',  // ← MỚI
  login: '/login',
  register: '/register',
  logout: '/logout',
  productDetail: ':nameId',
  cart: '/cart'
} as const
```

### Tại sao nhóm dưới `/user`?

Tất cả trang liên quan đến tài khoản cá nhân đều bắt đầu bằng `/user/`:

```
/user                    ← Route cha (layout chung)
  ├── /user/profile      ← Thông tin cá nhân
  ├── /user/password     ← Đổi mật khẩu
  └── /user/purchase     ← Lịch sử đơn hàng
```

**Lợi ích:**
1. **Tổ chức rõ ràng** — Nhìn URL biết ngay đây là nhóm trang User.
2. **Dùng chung layout** — Route cha `/user` gắn `UserLayout` (SideNav), các route con tự thừa hưởng.
3. **Bảo vệ hàng loạt** — Chỉ cần wrap `/user` trong `ProtectedRoute`, tất cả route con đều yêu cầu đăng nhập.

---

## 📁 2. Cấu Trúc Thư Mục `src/pages/User/` — Feature-Based Organization

```
src/pages/User/
├── components/                      ← Shared components dùng chung trong module User
│   └── UserSideNav/
│       ├── UserSideNav.tsx          ← Menu điều hướng bên trái
│       └── index.ts
├── layouts/                         ← Layouts riêng cho module User
│   └── UserLayout/
│       ├── UserLayout.tsx           ← SideNav + Outlet
│       └── index.ts
└── pages/                           ← Các trang con
    ├── Profile/
    │   ├── Profile.tsx              ← Trang thông tin cá nhân
    │   └── index.ts
    ├── ChangePassword/
    │   ├── ChangePassword.tsx       ← Trang đổi mật khẩu
    │   └── index.ts
    └── HistoryPurchase/
        ├── HistoryPurchase.tsx      ← Trang lịch sử mua hàng
        └── index.ts
```

### Feature-Based vs Type-Based:

```
❌ Type-Based (nhóm theo loại file):     ✅ Feature-Based (nhóm theo tính năng):
src/                                      src/pages/User/
├── components/                           ├── components/   ← Components CỦA User
│   ├── UserSideNav.tsx                   ├── layouts/      ← Layouts CỦA User
│   └── CartHeader.tsx                    └── pages/        ← Pages CỦA User
├── layouts/
│   ├── UserLayout.tsx
│   └── CartLayout.tsx
└── pages/
    ├── Profile.tsx
    └── Cart.tsx
```

Feature-Based tốt hơn vì **tất cả files liên quan đến User nằm cùng 1 nơi** — dễ tìm, dễ bảo trì, dễ xóa khi không cần nữa.

---

## 📁 3. `UserLayout.tsx` — Layout Lồng (Nested Layout)

```tsx
import { Outlet } from 'react-router-dom'
import UserSideNav from '../../components/UserSideNav'

export default function UserLayout() {
  return (
    <div>
      <UserSideNav />     {/* Menu bên trái — luôn hiển thị */}
      <Outlet />          {/* Nội dung trang — thay đổi theo URL */}
    </div>
  )
}
```

### `<Outlet />` hoạt động như thế nào?

`<Outlet />` là "chỗ trống" mà React Router tự động điền component con tương ứng vào:

```
URL hiện tại         →  <Outlet /> render cái gì?
─────────────────────────────────────────────────
/user/profile        →  <Profile />
/user/password       →  <ChangePassword />
/user/purchase       →  <HistoryPurchase />
```

### Minh họa các lớp Layout lồng nhau:

```
Khi truy cập /user/profile, React render:

<ProtectedRoute>                          ← Kiểm tra đăng nhập
  <MainLayout>                            ← Header + Footer
    <UserLayout>                          ← SideNav + Outlet
      <UserSideNav />                     ← Menu trái (luôn hiện)
      <Outlet>                            ← Chỗ trống
        → <Profile />                     ← React Router điền vào
      </Outlet>
    </UserLayout>
  </MainLayout>
</ProtectedRoute>
```

---

## 📁 4. `useRouteElements.tsx` — Cấu Hình Nested Routes

```tsx
{
  path: '',
  element: <ProtectedRoute />,       // Guard: phải đăng nhập
  children: [
    {
      path: path.cart,               // '/cart'
      element: (
        <CartLayout>
          <Cart />
        </CartLayout>
      )
    },
    {
      path: path.user,               // '/user' ← ROUTE CHA
      element: (
        <MainLayout>                 // Header + Footer
          <UserLayout />             // SideNav + <Outlet />
        </MainLayout>
      ),
      children: [                    // ← ROUTES CON (render vào Outlet)
        {
          path: path.profile,        // '/user/profile'
          element: <Profile />
        },
        {
          path: path.changePassword, // '/user/password'
          element: <ChangePassword />
        }
      ]
    }
  ]
}
```

### Giải thích cấu trúc route:

| Thuộc tính | Giá trị | Ý nghĩa |
|-----------|---------|---------|
| `path: path.user` | `'/user'` | Route cha — match URL bắt đầu bằng `/user` |
| `element: <MainLayout><UserLayout /></MainLayout>` | - | Layout bọc ngoài: Header + SideNav + Outlet + Footer |
| `children: [...]` | Mảng routes con | Các trang con render bên trong `<Outlet />` |
| `path: path.profile` | `'/user/profile'` | Route con — match URL chính xác `/user/profile` |

### So sánh TRƯỚC và SAU:

```tsx
// TRƯỚC — Profile nằm rời rạc, không có SideNav:
{
  path: path.profile,         // '/profile'
  element: (
    <MainLayout>
      <Profile />             // Chỉ có Header + Profile + Footer
    </MainLayout>
  )
}

// SAU — Profile nằm trong nhóm User, có SideNav:
{
  path: path.user,            // '/user' (route cha)
  element: (
    <MainLayout>
      <UserLayout />          // Header + SideNav + Outlet + Footer
    </MainLayout>
  ),
  children: [
    {
      path: path.profile,     // '/user/profile' (route con)
      element: <Profile />    // Render vào Outlet
    }
  ]
}
```

---

## 📁 5. Các Placeholder Components

Hiện tại tất cả page components chỉ là placeholder — chưa có UI thật:

```tsx
// UserSideNav.tsx
export default function UserSideNav() {
  return (<div>UserSideNav</div>)
}

// Profile.tsx
export default function Profile() {
  return (<div>Profile</div>)
}

// ChangePassword.tsx
export default function ChangePassword() {
  return (<div>ChangePassword</div>)
}

// HistoryPurchase.tsx
export default function HistoryPurchase() {
  return (<div>HistoryPurchase</div>)
}
```

> 💡 Đây là kỹ thuật **Scaffolding** — dựng khung sườn trước (routes, layouts, folder structure) rồi mới code UI chi tiết sau. Lợi ích: cấu trúc rõ ràng từ đầu, nhiều người có thể code song song các page khác nhau.

---

## 🔗 Bản Đồ Routing Toàn Bộ App

```
/                           → MainLayout > ProductList
/:nameId                    → MainLayout > ProductDetail

/login                      → RegisterLayout > Login         (RejectedRoute)
/register                   → RegisterLayout > Register      (RejectedRoute)

/cart                       → CartLayout > Cart              (ProtectedRoute)

/user                       → MainLayout > UserLayout        (ProtectedRoute)
  ├── /user/profile         →   UserLayout > Profile
  ├── /user/password        →   UserLayout > ChangePassword
  └── /user/purchase        →   (chưa thêm vào routes)
```

> ⚠️ **Lưu ý:** `HistoryPurchase` đã có file nhưng **chưa được thêm vào `useRouteElements.tsx`** — sẽ được bổ sung ở commit sau.

---

## 📌 Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Nested Routes** | Route con nằm trong route cha — route cha cung cấp layout chung, route con render vào `<Outlet />` |
| **`<Outlet />`** | Component đặc biệt của React    Router — đánh dấu "chỗ trống" để render route con matching |
| **Feature-Based Folder** | Nhóm tất cả files (components, layouts, pages) của 1 tính năng vào cùng 1 thư mục |
| **Scaffolding** | Dựng cấu trúc (routes, folders, placeholder components) trước, code chi tiết sau |
| **URL Grouping** | Nhóm các URL liên quan dưới 1 prefix chung (`/user/*`) — dễ quản lý route, layout, và bảo vệ |
| **Barrel Export (`index.ts`)** | File re-export: `export { default } from './Component'` — cho phép import gọn `from '~/pages/User/pages/Profile'` thay vì `from '~/pages/User/pages/Profile/Profile'` |
