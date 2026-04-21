# ea01900 — feat: Khai báo và test API cho phần profile

## Tổng Quan

Commit này là bước **chuẩn bị nền tảng** cho tính năng Profile. Nó chưa làm giao diện form, nhưng cung cấp đầy đủ "nguyên liệu" để các commit sau có thể xây dựng lên:

1. Tạo file API riêng cho user — gom các hàm gọi server liên quan đến user vào một chỗ.
2. Sửa lại kiểu dữ liệu `User` cho khớp với dữ liệu thật từ backend.
3. Sửa lỗi chính tả tên route `historyPurchase`.
4. Thêm route `/user/purchase` vào hệ thống router.

---

## Các File Thay Đổi

| File | Loại thay đổi | Vai trò |
|------|---------------|---------|
| `src/apis/user.api.ts` | Tạo mới | Chứa các hàm gọi API cho user |
| `src/types/user.type.ts` | Sửa | Cập nhật kiểu dữ liệu `User` |
| `src/constants/path.ts` | Sửa | Đổi `hitoryPurchase` → `historyPurchase` |
| `src/useRouteElements.tsx` | Sửa | Thêm route `/user/purchase` |

---

## 1. `src/apis/user.api.ts` — Tạo File API Riêng Cho User

### Tại sao cần file API riêng?

**Cách làm sai** — viết thẳng `http.get(...)` trong component:

```tsx
// Không nên làm thế này
export default function Profile() {
  useEffect(() => {
    http.get('me').then(res => setProfile(res.data.data))
  }, [])
}
```

Cách này có vấn đề:
- Nếu endpoint `me` đổi tên thành `profile`, phải tìm và sửa ở tất cả component đang dùng nó.
- Nhiều component cùng gọi chung một API nhưng mỗi nơi viết lại từ đầu → code lặp và khó bảo trì.

**Cách làm đúng** — tạo file API riêng:

```typescript
// src/apis/user.api.ts

const userApi = {
  getProfile() {
    return http.get<SuccessResponse<User>>('me')
  },
  updateProfile(body: BodyUpdateProfile) {
    return http.put<SuccessResponse<User>>('user', body)
  },
  uploadAvatar(body: FormData) {
    return http.post<SuccessResponse<string>>('user/upload-avatar', body, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }
}

export default userApi
```

Khi đó component chỉ cần gọi `userApi.getProfile()` mà không cần biết URL thật là gì. Đây là pattern **Service Layer** — gom toàn bộ logic giao tiếp với server vào một lớp riêng biệt.

### Giải thích 3 hàm trong `userApi`

#### `getProfile()`

```typescript
getProfile() {
  return http.get<SuccessResponse<User>>('me')
}
```

Gọi `GET /me` để lấy thông tin của user đang đăng nhập. Server nhận request, đọc access token trong header Authorization, tra cứu user tương ứng, rồi trả về profile của họ.

Luồng hoạt động:
```
Frontend gửi GET /me (kèm access_token trong header)
    ↓
Backend giải mã token → biết user là ai
    ↓
Backend trả về profile của user đó
```

#### `updateProfile(body)`

```typescript
updateProfile(body: BodyUpdateProfile) {
  return http.put<SuccessResponse<User>>('user', body)
}
```

Gọi `PUT /user` để cập nhật thông tin profile. Phương thức `PUT` thường dùng để **thay thế hoàn toàn** resource (khác với `PATCH` chỉ cập nhật một phần).

#### `uploadAvatar(body)`

```typescript
uploadAvatar(body: FormData) {
  return http.post<SuccessResponse<string>>('user/upload-avatar', body, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}
```

Upload ảnh đại diện lên server. Khác với các request thông thường gửi JSON, upload file phải dùng định dạng `multipart/form-data`. Header `Content-Type` cần được set tường minh để server biết cách parse request body.

**Tại sao return type là `SuccessResponse<string>` chứ không phải `SuccessResponse<User>`?**

Vì API upload avatar chỉ trả về **tên file** trên server (ví dụ: `"abc123-avatar.png"`), không phải toàn bộ User object. Tên file này sẽ được dùng tiếp ở bước update profile.

---

## 2. `BodyUpdateProfile` — Kiểu Dữ Liệu Cho Request Cập Nhật

```typescript
interface BodyUpdateProfile extends Omit<User, '_id' | 'roles' | 'createdAt' | 'updatedAt' | 'email'> {
  password?: string
  new_password?: string
}
```

### Tại sao không gửi toàn bộ `User` object lên server?

**`User`** là kiểu dữ liệu đầy đủ bao gồm `_id`, `roles`, `createdAt`, `updatedAt`, `email`... Nhưng khi cập nhật profile, một số field không nên (hoặc không được phép) sửa:

| Field | Lý do không gửi |
|-------|----------------|
| `_id` | ID do server tạo, không bao giờ được sửa |
| `roles` | Quyền hạn user, chỉ admin mới được đổi |
| `createdAt` | Timestamp tự động, server tự quản lý |
| `updatedAt` | Timestamp tự động, server tự cập nhật |
| `email` | Thường không cho đổi email qua form profile |

**`Omit<User, '_id' | 'roles' | ...>`** tạo ra một type mới bằng cách lấy `User` rồi bỏ đi các field được liệt kê. Đây là cách TypeScript để tái sử dụng type mà không phải viết lại từ đầu.

Sau đó extend thêm 2 field riêng cho trường hợp đổi mật khẩu:

```typescript
{
  password?: string      // Mật khẩu hiện tại (cần để xác minh danh tính)
  new_password?: string  // Mật khẩu mới
}
```

---

## 3. `src/types/user.type.ts` — Sửa Kiểu Dữ Liệu `User`

### Trước commit:

```typescript
interface User {
  name: string          // Bắt buộc phải có
  date_of_birth: null   // Luôn là null
  address: string       // Bắt buộc phải có
  phone: string         // Bắt buộc phải có
}
```

### Sau commit:

```typescript
interface User {
  name?: string         // Có thể undefined
  date_of_birth?: string // Có thể undefined, và là string (ISO date)
  avatar?: string       // Có thể undefined (field mới)
  address?: string      // Có thể undefined
  phone?: string        // Có thể undefined
}
```

### Tại sao phải thêm dấu `?` (optional)?

Khi user **mới tạo tài khoản**, họ chưa nhập tên, địa chỉ, số điện thoại, chưa upload avatar, chưa chọn ngày sinh. Lúc này server trả về các field này với giá trị `undefined` hoặc `null`.

Nếu type khai báo `name: string` (bắt buộc), TypeScript sẽ tin rằng `name` luôn có giá trị. Khi code viết `profile.name.toUpperCase()`, TypeScript không báo lỗi — nhưng khi chạy thật, `name` là `undefined` → **crash runtime**.

Khai báo `name?: string` (optional) buộc lập trình viên phải kiểm tra: `profile.name?.toUpperCase()` hoặc `profile.name ? profile.name : 'Chưa có tên'`. TypeScript giúp **phát hiện lỗi tại compile time** thay vì runtime.

### Tại sao `date_of_birth` đổi từ `null` sang `string?`

Backend thường trả ngày sinh dưới dạng **chuỗi ISO 8601**:

```
"1999-10-22T00:00:00.000Z"
```

Frontend sẽ nhận chuỗi này rồi chuyển thành `Date` object khi cần tính toán hoặc hiển thị:

```typescript
new Date(profile.date_of_birth!)  // "1999-10-22T..." → Date object
```

### Tại sao thêm field `avatar`?

Chức năng upload ảnh đại diện sẽ được làm trong các commit sau. Field này cần được khai báo trước để TypeScript biết `User` object có thể chứa `avatar`.

---

## 4. `src/constants/path.ts` — Sửa Lỗi Chính Tả

```diff
- hitoryPurchase: '/user/purchase'
+ historyPurchase: '/user/purchase'
```

**"hitoryPurchase"** bị thiếu chữ "s" trong "history". Đây là lỗi chính tả đơn giản nhưng quan trọng vì:

- Code tự đề xuất (autocomplete) sẽ hiện `hitoryPurchase` — người đọc dễ bị nhầm
- Nếu ai không để ý dùng `path.hitoryPurchase` ở nơi khác, khi đổi tên sẽ phải tìm và sửa hết

**Giá trị URL không đổi** — vẫn là `/user/purchase`. Chỉ đổi tên **key** trong object `path`.

---

## 5. `src/useRouteElements.tsx` — Thêm Route Cho Lịch Sử Mua Hàng

```tsx
import HistoryPurchase from '~/pages/User/pages/HistoryPurchase'

// Bên trong mảng children của ProtectedRoute:
{
  path: path.historyPurchase,   // '/user/purchase'
  element: <HistoryPurchase />
}
```

### React Router hoạt động thế nào?

React Router duy trì một danh sách **route definitions** — mỗi route là sự kết hợp giữa một URL pattern và một component tương ứng. Khi URL trình duyệt thay đổi, Router tìm route phù hợp và render component đó.

File `HistoryPurchase.tsx` đã tồn tại từ commit trước (là component placeholder `<div>HistoryPurchase</div>`), nhưng nếu không khai báo route thì Router không biết "URL `/user/purchase` cần render component nào" → URL đó sẽ không match và hiện trang 404.

Sau commit này, hệ thống route cho nhóm User hoàn chỉnh:

```
/user/profile   → render Profile
/user/password  → render ChangePassword
/user/purchase  → render HistoryPurchase  ← Mới thêm
```

---

## Luồng Hoạt Động Sau Commit

```
1. App đã có route /user/purchase → user có thể truy cập trang Lịch sử mua hàng
2. userApi.getProfile() đã sẵn sàng → commit sau dùng để lấy và hiển thị dữ liệu form
3. Kiểu dữ liệu User đã phản ánh đúng dữ liệu thật → TypeScript không báo lỗi giả
4. Lỗi chính tả path.historyPurchase đã sửa → code nhất quán
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Service Layer (API module)** | Gom tất cả hàm gọi API liên quan đến một tính năng vào một file riêng. Component chỉ gọi hàm trong module đó, không biết URL hay HTTP method cụ thể. Khi API thay đổi, chỉ sửa một chỗ duy nhất. |
| **`Omit<T, K>`** | TypeScript utility type để tạo type mới bằng cách bỏ đi một số field từ type gốc. Tránh việc phải khai báo lại từ đầu khi type mới chỉ khác type cũ một vài field. |
| **Optional field (`?`)** | Field có dấu `?` có thể là `undefined`. Buộc lập trình viên kiểm tra trước khi dùng, giúp phát hiện lỗi tại compile time thay vì runtime. |
| **`FormData`** | API browser dùng để gửi dữ liệu dạng `multipart/form-data` — bắt buộc khi upload file. Dữ liệu không gửi dạng JSON mà gửi dạng binary stream. |
| **Khai báo route** | Muốn truy cập được một trang bằng URL thì phải đăng ký route trong file cấu hình router. Tạo component mà không có route tương ứng thì component đó vô hình với người dùng. |
