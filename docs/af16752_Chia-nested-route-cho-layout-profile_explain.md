# af16752 — feat: Chia nested route cho layout profile

## Tổng Quan

Commit này thiết lập **cấu trúc Nested Routes** cho nhóm trang quản lý tài khoản (Profile, Đổi mật khẩu, Lịch sử mua hàng). Đây là bước **dựng khung sườn (scaffolding)** — các component chưa có UI chi tiết, chỉ là placeholder để xác định routing và folder structure trước.

Mục tiêu kiến trúc: cả 3 trang dưới `/user/` chia sẻ cùng một layout (Header ở trên, SideNav ở bên trái, Footer ở dưới), chỉ phần content giữa thay đổi theo URL:

```
URL: /user/profile            URL: /user/password
┌─────────────────────────┐   ┌─────────────────────────┐
│ Header                  │   │ Header                  │
├──────┬──────────────────┤   ├──────┬──────────────────┤
│ Side │                  │   │ Side │                  │
│ Nav  │ Profile Content  │   │ Nav  │ ChangePassword   │
│      │                  │   │      │                  │
├──────┴──────────────────┤   ├──────┴──────────────────┤
│ Footer                  │   │ Footer                  │
└─────────────────────────┘   └─────────────────────────┘
Header, Footer, SideNav GIỐNG NHAU — chỉ content giữa thay đổi
```

---

## Các File Thay Đổi

### Files tạo mới:

| File | Vai trò |
|------|---------|
| `src/pages/User/components/UserSideNav/UserSideNav.tsx` | Menu điều hướng bên trái (placeholder) |
| `src/pages/User/layouts/UserLayout/UserLayout.tsx` | Layout lồng: SideNav + `<Outlet />` |
| `src/pages/User/pages/Profile/Profile.tsx` | Trang thông tin cá nhân (placeholder) |
| `src/pages/User/pages/ChangePassword/ChangePassword.tsx` | Trang đổi mật khẩu (placeholder) |
| `src/pages/User/pages/HistoryPurchase/HistoryPurchase.tsx` | Trang lịch sử mua hàng (placeholder) |
| Các file `index.ts` tương ứng | Barrel export |

### Files sửa:

| File | Thay đổi |
|------|----------|
| `src/constants/path.ts` | Thêm routes `/user`, `/user/profile`, `/user/password`, `/user/purchase` |
| `src/useRouteElements.tsx` | Cấu hình nested routes cho nhóm User |

---

## 1. `src/constants/path.ts` — Định Nghĩa Routes Mới

```typescript
const path = {
  home: '/',
  user: '/user',                     // Route cha cho nhóm User
  profile: '/user/profile',          // Trang thông tin cá nhân
  changePassword: '/user/password',  // Trang đổi mật khẩu
  hitoryPurchase: '/user/purchase',  // Trang lịch sử mua hàng (lỗi chính tả, sửa sau)
  login: '/login',
  register: '/register',
  productDetail: ':nameId',
  cart: '/cart'
} as const
```

### Tại sao nhóm các trang dưới `/user/`?

Tất cả trang liên quan đến tài khoản cá nhân đều bắt đầu bằng `/user/`. Điều này mang lại 3 lợi ích:

**1. Tổ chức URL rõ ràng** — Nhìn vào URL biết ngay đây là nhóm trang liên quan đến user.

**2. Dùng chung layout hiệu quả** — Route cha `/user` được gắn `UserLayout` (chứa SideNav), tất cả route con `/user/profile`, `/user/password`, `/user/purchase` tự động thừa hưởng layout đó mà không cần khai báo lại.

**3. Bảo vệ hàng loạt** — Chỉ cần bọc route cha `/user` trong `ProtectedRoute` (yêu cầu đăng nhập), tất cả route con đều được bảo vệ tự động.

---

## 2. Cấu Trúc Thư Mục — Feature-Based Organization

```
src/pages/User/
├── components/                  ← Shared components chỉ dùng trong module User
│   └── UserSideNav/
│       ├── UserSideNav.tsx
│       └── index.ts
├── layouts/                     ← Layout riêng cho module User
│   └── UserLayout/
│       ├── UserLayout.tsx
│       └── index.ts
└── pages/                       ← Các trang con của User
    ├── Profile/
    ├── ChangePassword/
    └── HistoryPurchase/
```

### Feature-Based vs Type-Based — cách tổ chức folder nào tốt hơn?

**Type-Based (nhóm theo loại file):**
```
src/
├── components/
│   ├── UserSideNav.tsx    ← Component của User
│   └── CartHeader.tsx     ← Component của Cart
├── layouts/
│   ├── UserLayout.tsx
│   └── CartLayout.tsx
└── pages/
    ├── Profile.tsx
    └── Cart.tsx
```

**Feature-Based (nhóm theo tính năng):**
```
src/pages/User/
├── components/   ← Chỉ chứa components CỦA User
├── layouts/      ← Chỉ chứa layouts CỦA User
└── pages/        ← Chỉ chứa pages CỦA User
```

Feature-Based tốt hơn vì **tất cả files liên quan đến một tính năng nằm cùng một chỗ**. Khi cần xóa hoặc refactor tính năng User, chỉ cần xóa thư mục `pages/User/` — không bị phân tán khắp nơi.

---

## 3. `UserLayout.tsx` — Layout Lồng (Nested Layout)

```tsx
import { Outlet } from 'react-router-dom'
import UserSideNav from '../../components/UserSideNav'

export default function UserLayout() {
  return (
    <div>
      <UserSideNav />   {/* Menu bên trái — luôn hiển thị cho mọi trang User */}
      <Outlet />        {/* Nội dung trang — thay đổi theo URL */}
    </div>
  )
}
```

### `<Outlet />` là gì và hoạt động thế nào?

`<Outlet />` là component đặc biệt của React Router — đây là "vị trí placeholder" mà React Router sẽ tự động điền component con tương ứng vào dựa trên URL hiện tại:

```
URL hiện tại         →  <Outlet /> render cái gì?
─────────────────────────────────────────────────
/user/profile        →  <Profile />
/user/password       →  <ChangePassword />
/user/purchase       →  <HistoryPurchase />
```

`UserSideNav` nằm ngoài `<Outlet />` nên nó **luôn hiển thị**, bất kể route con nào đang active.

### Hình dung các lớp lồng nhau khi truy cập `/user/profile`:

```
<ProtectedRoute>                 ← Kiểm tra đã đăng nhập chưa
  <MainLayout>                   ← Header + Footer (layout toàn trang)
    <UserLayout>                 ← SideNav + Outlet (layout nhóm User)
      <UserSideNav />            ← Menu trái (luôn hiện)
      <Outlet>                   ← Chỗ trống, React Router điền tiếp
        <Profile />              ← Component của route /user/profile
      </Outlet>
    </UserLayout>
  </MainLayout>
</ProtectedRoute>
```

---

## 4. `useRouteElements.tsx` — Cấu Hình Nested Routes

```tsx
{
  path: '',
  element: <ProtectedRoute />,   // Yêu cầu đăng nhập
  children: [
    {
      path: path.cart,
      element: (
        <CartLayout>
          <Cart />
        </CartLayout>
      )
    },
    {
      path: path.user,           // '/user' - Route cha
      element: (
        <MainLayout>
          <UserLayout />         // UserLayout chứa <Outlet /> bên trong
        </MainLayout>
      ),
      children: [                // Route con → render vào <Outlet /> của UserLayout
        {
          path: path.profile,    // '/user/profile'
          element: <Profile />   // Render vào Outlet
        },
        {
          path: path.changePassword,  // '/user/password'
          element: <ChangePassword />
        }
      ]
    }
  ]
}
```

### Hiểu cơ chế hoạt động của Nested Routes:

React Router xử lý URL từ trên xuống. Khi URL là `/user/profile`:

1. Khớp route cha `path: ''` (ProtectedRoute) → kiểm tra đăng nhập
2. Trong `children`, khớp `path: '/user'` → render `<MainLayout><UserLayout /></MainLayout>`
3. `UserLayout` có `<Outlet />` → React Router tìm tiếp trong `children` của route `/user`
4. Khớp `path: '/user/profile'` → render `<Profile />` vào `<Outlet />`

**Điều quan trọng:** `UserLayout` không biết gì về `Profile`, `ChangePassword`, hay `HistoryPurchase`. Nó chỉ cung cấp layout và một `<Outlet />`. React Router tự lo phần điền component con vào.

### So sánh trước và sau nested routes:

```tsx
// TRƯỚC — Profile nằm rời rạc, không có SideNav:
{
  path: '/profile',        ← URL khác
  element: (
    <MainLayout>
      <Profile />          ← Chỉ có Header + Profile + Footer, không có SideNav
    </MainLayout>
  )
}

// SAU — Profile thuộc nhóm /user, có SideNav:
{
  path: '/user',           ← Route cha
  element: (
    <MainLayout>
      <UserLayout />       ← Header + SideNav + Outlet + Footer
    </MainLayout>
  ),
  children: [
    {
      path: '/user/profile',  ← Route con
      element: <Profile />    ← Render vào Outlet
    }
  ]
}
```

---

## 5. Tại Sao Dùng Scaffolding?

Hiện tại tất cả page components chỉ là placeholder:

```tsx
export default function Profile() {
  return <div>Profile</div>
}

export default function ChangePassword() {
  return <div>ChangePassword</div>
}
```

Đây là kỹ thuật **Scaffolding** — dựng cấu trúc (routes, folder, placeholder components) trước, code UI chi tiết sau. Lợi ích:

- **Cấu trúc rõ ràng từ đầu** — mọi người trong nhóm biết trang nào nằm ở đâu
- **Phân công song song** — một người làm Profile UI, người khác làm ChangePassword UI, không đụng nhau
- **Test routing sớm** — có thể kiểm tra navigation giữa các trang ngay mà chưa cần UI hoàn chỉnh

---

## Bản Đồ Routing Toàn Bộ App Sau Commit Này

```
/                           → MainLayout > ProductList
/:nameId                    → MainLayout > ProductDetail

/login                      → RegisterLayout > Login         (RejectedRoute)
/register                   → RegisterLayout > Register      (RejectedRoute)

/cart                       → CartLayout > Cart              (ProtectedRoute)

/user                       → MainLayout > UserLayout        (ProtectedRoute)
  ├── /user/profile         →   UserLayout > Profile
  └── /user/password        →   UserLayout > ChangePassword

(Lưu ý: /user/purchase chưa được thêm vào routes ở commit này — sẽ bổ sung ở commit ea01900)
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Nested Routes** | Route con nằm trong `children` của route cha. Route cha cung cấp layout chung và `<Outlet />`, route con render vào `<Outlet />` đó. Giúp chia sẻ layout mà không lặp code. |
| **`<Outlet />`** | Component của React Router đánh dấu "vị trí trống" để render route con matching. Không cần biết trước route con là gì — React Router tự điền vào đúng component. |
| **Feature-Based Folder Structure** | Nhóm tất cả files (components, layouts, pages) của một tính năng vào cùng một thư mục. Giúp dễ tìm, dễ bảo trì, dễ xóa khi không cần nữa. |
| **Scaffolding** | Dựng khung cấu trúc (routes, folders, placeholder components) trước khi có UI thật. Cho phép nhiều người làm song song và có routing hoạt động sớm. |
| **URL Grouping** | Nhóm các URL liên quan dưới một prefix chung (`/user/*`). Dễ áp dụng layout chung và bảo vệ hàng loạt chỉ bằng một route cha. |
| **Barrel Export (`index.ts`)** | File `index.ts` chứa `export { default } from './Component'`. Cho phép import gọn: `from '~/pages/User/pages/Profile'` thay vì `from '~/pages/User/pages/Profile/Profile'`. |
