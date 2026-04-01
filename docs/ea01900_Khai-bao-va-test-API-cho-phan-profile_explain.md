# ea01900 — feat: Khai báo và test API cho phần profile

## 🎯 Tổng Quan

Commit này làm 4 việc chính cho phần **Profile**:

1. Tạo file API riêng cho user: lấy profile, cập nhật profile, upload avatar.
2. Sửa lại kiểu dữ liệu `User` để phù hợp hơn với dữ liệu thật từ backend.
3. Sửa lỗi chính tả ở route `historyPurchase`.
4. Thêm route cho trang `HistoryPurchase` vào hệ thống router.

> 💡 Có thể hiểu đơn giản: commit này đang **chuẩn bị dữ liệu và đường dẫn** để những commit sau có thể làm form Profile thật.

---

## 📁 Tổng Quan Các File Thay Đổi

| File | Loại thay đổi | Vai trò |
|------|---------------|---------|
| `src/apis/user.api.ts` | Tạo mới | Chứa các hàm gọi API cho user |
| `src/types/user.type.ts` | Sửa | Cập nhật kiểu dữ liệu `User` |
| `src/constants/path.ts` | Sửa | Đổi `hitoryPurchase` thành `historyPurchase` |
| `src/useRouteElements.tsx` | Sửa | Thêm route `/user/purchase` |

---

## 📁 1. `src/apis/user.api.ts` — Tạo File API Riêng Cho User

```ts
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
```

### File này dùng để làm gì?

Trước đây phần Profile chưa có chỗ riêng để gọi API. Commit này tạo ra `userApi` để gom tất cả API liên quan đến user vào một chỗ.

### Có 3 hàm chính:

#### `getProfile()`

```ts
return http.get<SuccessResponse<User>>('me')
```

Hàm này gọi API lấy thông tin user đang đăng nhập.

Ví dụ:

```text
User đã đăng nhập
   ↓
Frontend gọi GET /me
   ↓
Backend trả về profile của user đó
```

#### `updateProfile(body)`

```ts
return http.put<SuccessResponse<User>>('user', body)
```

Hàm này dùng để gửi dữ liệu mới lên server khi user chỉnh sửa profile.

Ví dụ:

```text
User sửa tên, địa chỉ, số điện thoại
   ↓
Frontend gọi PUT /user
   ↓
Backend cập nhật thông tin mới
```

#### `uploadAvatar(body)`

```ts
return http.post<SuccessResponse<string>>('user/upload-avatar', body, {
  headers: {
    'Content-Type': 'multipart/form-data'
  }
})
```

Hàm này dùng để upload ảnh đại diện.

Vì upload file nên không gửi JSON bình thường, mà phải dùng:

- `FormData`
- `multipart/form-data`

### Tại sao nên tách thành file `user.api.ts`?

Nếu sau này viết thẳng `http.get(...)` trong component thì component sẽ rất rối.

Tách riêng file API giúp:

1. Dễ đọc hơn.
2. Dễ tái sử dụng ở nhiều nơi.
3. Dễ bảo trì nếu endpoint thay đổi.

---

## 📁 2. `BodyUpdateProfile` — Chỉ Cho Phép Gửi Những Field Cần Thiết

```ts
interface BodyUpdateProfile extends Omit<User, '_id' | 'roles' | 'createdAt' | 'updatedAt' | 'email'> {
  password?: string
  newPassword?: string
}
```

### Ý nghĩa đoạn này

`User` là kiểu dữ liệu đầy đủ của một người dùng. Nhưng khi update profile, không phải field nào cũng được phép gửi lên server.

Ví dụ:

- Không cần gửi `_id`
- Không cần gửi `createdAt`
- Không cần gửi `updatedAt`
- Không cần gửi `roles`
- `email` thường không sửa ở form profile

Nên tác giả dùng `Omit<...>` để bỏ đi các field không cần thiết.

### Hiểu đơn giản:

```text
User đầy đủ            → dữ liệu đọc từ backend
BodyUpdateProfile      → dữ liệu được phép gửi lên khi update
```

Đây là cách viết rất tốt vì tránh gửi nhầm dữ liệu thừa.

---

## 📁 3. `src/types/user.type.ts` — Sửa Kiểu Dữ Liệu User

### Trước commit:

```ts
name: string
date_of_birth: null
address: string
phone: string
```

### Sau commit:

```ts
name?: string
date_of_birth?: string
avatar?: string
address?: string
phone?: string
```

### Vì sao phải sửa?

Vì dữ liệu profile ngoài thực tế có thể chưa đầy đủ.

Ví dụ user mới tạo tài khoản:

- chưa nhập tên
- chưa nhập địa chỉ
- chưa có số điện thoại
- chưa upload avatar
- chưa chọn ngày sinh

Nếu vẫn để các field này là bắt buộc thì TypeScript sẽ hiểu rằng lúc nào chúng cũng có dữ liệu, trong khi thực tế có thể là `undefined`.

### `date_of_birth` vì sao đổi sang `string?`

Backend thường trả ngày sinh ở dạng chuỗi, ví dụ:

```text
1999-10-22T00:00:00.000Z
```

Frontend sau đó mới đổi chuỗi này sang `Date` nếu cần.

Nên đổi từ `null` sang `string?` là hợp lý hơn với dữ liệu thật.

### `avatar?: string` là gì?

Thêm field `avatar` để lưu đường dẫn ảnh đại diện của user.

---

## 📁 4. `src/constants/path.ts` — Sửa Lỗi Chính Tả Tên Route

```ts
- hitoryPurchase: '/user/purchase',
+ historyPurchase: '/user/purchase',
```

### Đây là thay đổi nhỏ nhưng cần thiết

`hitoryPurchase` là viết sai chính tả. Đúng phải là `historyPurchase`.

Giá trị URL không đổi:

```ts
'/user/purchase'
```

Chỉ đổi tên key để:

1. Dễ đọc hơn
2. Ít nhầm hơn khi import ở nơi khác
3. Code nhìn sạch hơn

---

## 📁 5. `src/useRouteElements.tsx` — Thêm Route Cho Lịch Sử Mua Hàng

Commit này thêm import:

```tsx
import HistoryPurchase from '~/pages/User/pages/HistoryPurchase'
```

Và thêm route:

```tsx
{
  path: path.historyPurchase,
  element: <HistoryPurchase />
}
```

### Tại sao cần thêm đoạn này?

Ở commit trước, file `HistoryPurchase` đã được tạo rồi, nhưng nếu không khai báo route thì khi truy cập URL tương ứng, React Router sẽ không biết phải render trang nào.

### Sau commit này:

```text
/user/profile   → render Profile
/user/password  → render ChangePassword
/user/purchase  → render HistoryPurchase
```

Nghĩa là trang Lịch sử mua hàng đã chính thức được nối vào hệ thống route.

---

## 🔗 Luồng Hoạt Động Sau Commit

```text
1. App đã có route /user/purchase
2. Module user đã có file API riêng là userApi
3. Kiểu dữ liệu User đã phù hợp hơn với dữ liệu thật
4. Những commit sau có thể dùng userApi.getProfile() để đổ dữ liệu lên form
```

Commit này chưa làm form Profile hoàn chỉnh, nhưng nó là bước nền quan trọng để làm được việc đó.

---

## 📌 Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **API riêng theo module** | Mỗi module có 1 file API riêng như `user.api.ts`, giúp code gọn và dễ quản lý |
| **`Omit<T, K>`** | Lấy một type cũ rồi bỏ đi một số field không muốn dùng |
| **Optional field (`?`)** | Field có thể có hoặc không có dữ liệu |
| **`FormData`** | Kiểu dữ liệu dùng để gửi file lên server |
| **Khai báo route** | Muốn truy cập được một trang bằng URL thì phải thêm route trong router |
