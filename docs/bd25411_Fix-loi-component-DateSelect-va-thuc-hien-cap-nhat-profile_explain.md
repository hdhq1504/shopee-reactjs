# bd25411 — fix: Fix lỗi component DateSelect và thực hiện cập nhật profile

## 🎯 Tổng Quan

Commit này sửa và hoàn thiện phần **Profile** thêm một bước nữa. Có 4 ý chính:

1. Sửa lỗi component `DateSelect` để chọn đúng ngày / tháng / năm.
2. Nối form Profile với API update thật, không còn chỉ `console.log`.
3. Hiển thị avatar và email thật của user ở `NavHeader` và `UserSideNav`.
4. Sửa một lỗi typing ở `AsideFilter` khi tạo query string lọc giá.

Ngoài ra commit này cũng thêm một số file tài liệu như:

- `api-document.md`
- 2 file explain trong thư mục `docs`

> 💡 Nếu commit `da42922` mới dừng ở bước “đổ dữ liệu lên form”, thì commit này đi tiếp bước “bấm Lưu để cập nhật profile thật”.

---

## 📁 Tổng Quan Các File Thay Đổi

| File | Loại thay đổi | Vai trò |
|------|---------------|---------|
| `src/pages/User/components/DateSelect/DateSelect.tsx` | Sửa | Fix logic chọn ngày sinh |
| `src/pages/User/pages/Profile/Profile.tsx` | Sửa lớn | Gọi API update profile thật |
| `src/apis/user.api.ts` | Sửa | Đổi `newPassword` thành `new_password` cho đúng format API |
| `src/utils/rules.ts` | Sửa | Đồng bộ tên field schema theo backend |
| `src/components/NavHeader/NavHeader.tsx` | Sửa | Hiển thị avatar thật hoặc ảnh mặc định |
| `src/pages/User/components/UserSideNav/UserSideNav.tsx` | Sửa | Hiển thị avatar và email thật của user |
| `src/assets/images/user.svg` | Tạo mới | Ảnh mặc định khi user chưa có avatar |
| `src/pages/ProductList/components/AsideFilter/AsideFilter.tsx` | Sửa | Sửa kiểu dữ liệu và cách tạo search params |
| `index.html` | Sửa nhỏ | Đổi tiêu đề tab trình duyệt |
| `api-document.md` | Tạo mới | Tài liệu mô tả API |

---

## 📁 1. `DateSelect.tsx` — Sửa Lỗi Chọn Sai Tháng Và Năm

### Lỗi cũ là gì?

Ở commit trước, 2 ô select `tháng` và `năm` đang bị sai:

- Cả 2 đều để `name='date'`
- `value` của month và year cũng đang lấy nhầm từ `date.date`

Điều đó dẫn đến việc:

```text
User đổi tháng
   ↓
Component lại hiểu là đang đổi ngày
   ↓
Ngày sinh bị sai
```

### Commit này sửa gì?

#### Sửa `name` của từng select:

```tsx
name='month'
name='year'
```

thay vì cả 3 ô đều dùng `name='date'`.

#### Sửa `value` cho đúng field:

```tsx
value={value?.getMonth() ?? date.month}
value={value?.getFullYear() ?? date.year}
```

### Sửa thêm ở `handleChange`

```ts
const { value: valueFromSelect, name } = event.target
const newDate = {
  date: value?.getDate() || date.date,
  month: value?.getMonth() || date.month,
  year: value?.getFullYear() || date.year,
  [name]: Number(valueFromSelect)
}
```

### Ý nghĩa

Khi user đổi 1 ô select:

1. Giữ nguyên 2 phần còn lại
2. Chỉ cập nhật phần đang thay đổi
3. Tạo lại `Date` mới chính xác

### Thêm `useEffect` để đồng bộ lại state nội bộ

```ts
useEffect(() => {
  if (value) {
    setDate({
      date: value.getDate(),
      month: value.getMonth(),
      year: value.getFullYear()
    })
  }
}, [value])
```

### Tại sao cần `useEffect` này?

`DateSelect` có state bên trong là `date`, nhưng giá trị thật của form lại đến từ prop `value`.

Nếu bên ngoài đổi `value` mà component không cập nhật state nội bộ, UI có thể hiển thị sai.

Ví dụ:

```text
API trả ngày sinh của user = 2001-10-15
   ↓
Profile dùng setValue(...) cập nhật form
   ↓
DateSelect nhận prop mới
   ↓
useEffect đồng bộ lại 3 ô select
```

Nhờ đó component hiển thị đúng dữ liệu từ form.

---

## 📁 2. `Profile.tsx` — Thực Hiện Cập Nhật Profile Thật

Đây là phần quan trọng nhất của commit.

### Trước commit này

Khi user bấm nút `Lưu`, code chỉ:

```ts
console.log(data)
```

Tức là form mới chỉ lấy được dữ liệu, nhưng chưa gửi lên server.

### Sau commit này

Thêm mutation:

```ts
const updateProfileMutation = useMutation({
  mutationFn: userApi.updateProfile
})
```

Và khi submit:

```ts
const onSubmit = handleSubmit(async (data) => {
  const res = await updateProfileMutation.mutateAsync({
    ...data,
    date_of_birth: data.date_of_birth?.toISOString()
  })
  setProfile(res.data.data)
  setProfileToLS(res.data.data)
  refetch()
  toast.success(res.data.message)
})
```

### Giải thích từng bước

#### Bước 1. Submit form

`handleSubmit(...)` lấy dữ liệu hợp lệ từ form.

#### Bước 2. Gọi API update

```ts
await updateProfileMutation.mutateAsync(...)
```

Ở đây dùng `mutateAsync` để chờ kết quả trả về từ server.

#### Bước 3. Đổi `date_of_birth` sang chuỗi ISO

```ts
date_of_birth: data.date_of_birth?.toISOString()
```

Trong form, `date_of_birth` đang là kiểu `Date`.

Nhưng backend thường cần chuỗi ngày kiểu:

```text
2026-04-01T00:00:00.000Z
```

Nên phải đổi bằng `.toISOString()` trước khi gửi.

#### Bước 4. Cập nhật lại `AppContext`

```ts
setProfile(res.data.data)
```

Điều này giúp những nơi đang dùng `profile` trong app cập nhật ngay sau khi save.

#### Bước 5. Lưu lại Local Storage

```ts
setProfileToLS(res.data.data)
```

Giúp khi reload trang, app vẫn có thông tin profile mới.

#### Bước 6. Gọi lại `refetch()`

```ts
refetch()
```

Gọi lại API `getProfile` để chắc dữ liệu mới nhất từ server đã đồng bộ về.

#### Bước 7. Hiện thông báo thành công

```ts
toast.success(res.data.message)
```

User sẽ thấy thông báo sau khi cập nhật thành công.

---

## 📁 3. `FormInput` Và `FormData` — Tách Kiểu Dữ Liệu Input Và Output

Commit này thêm:

```ts
type FormInput = {
  name: string | undefined
  phone: string | undefined
  address: string | undefined
  avatar: string | undefined
  date_of_birth: Date | undefined
}
```

Và dùng:

```ts
useForm<FormInput, unknown, FormData>({...})
```

### Ý nghĩa đơn giản

Trong form:

- `date_of_birth` đang làm việc với `Date`

Nhưng dữ liệu cuối cùng sau khi validate lại muốn theo kiểu của schema/profile.

Tác giả tách ra:

- `FormInput`: kiểu dữ liệu đang nhập trong form
- `FormData`: kiểu dữ liệu đầu ra sau validate

Đây là cách viết giúp TypeScript hiểu rõ hơn dữ liệu ở từng bước.

---

## 📁 4. `user.api.ts` Và `rules.ts` — Đồng Bộ Tên Field Với Backend

### Trong `user.api.ts`

```ts
- newPassword?: string
+ new_password?: string
```

### Trong `rules.ts`

```ts
- confirmPassword
- newPassword
+ confirm_password
+ new_password
```

### Tại sao phải sửa?

Backend API đang dùng kiểu tên:

```text
new_password
confirm_password
```

Nếu frontend dùng:

```text
newPassword
confirmPassword
```

thì khi gửi request rất dễ bị lệch tên field với backend.

Commit này sửa lại để thống nhất với API document.

---

## 📁 5. `NavHeader.tsx` — Hiển Thị Avatar Thật Của User

Trước đây avatar ở header đang dùng một ảnh URL cố định:

```tsx
src='https://cf.shopee.vn/file/...'
```

Sau commit:

```tsx
<img src={profile?.avatar || userImage} alt='avatar' className='h-full w-full rounded-full object-cover' />
```

### Ý nghĩa

- Nếu user có avatar thật → hiển thị avatar đó
- Nếu chưa có avatar → dùng ảnh mặc định `user.svg`

Điều này giúp giao diện “đúng với user hiện tại” hơn, không còn dùng ảnh cứng.

---

## 📁 6. `UserSideNav.tsx` — Hiển Thị Email Và Avatar Thật

Commit này thêm:

```tsx
const { profile } = useContext(AppContext)
```

và thay nội dung cũ bằng dữ liệu thật:

```tsx
<img src={profile?.avatar || userImage} ... />
<div>{profile?.email}</div>
```

### Trước đây

- Avatar là ảnh cứng
- Tên hiển thị là text cứng `cdthanh`

### Sau commit này

- Avatar lấy từ profile thật
- Text hiển thị là email thật của user

Nhờ vậy sidebar đồng bộ hơn với dữ liệu đăng nhập hiện tại.

---

## 📁 7. `user.svg` — Ảnh Mặc Định Khi Chưa Có Avatar

Commit này thêm file:

```text
src/assets/images/user.svg
```

File này đóng vai trò là ảnh dự phòng.

### Khi nào dùng?

```text
profile?.avatar có dữ liệu     → dùng avatar thật
profile?.avatar không có       → dùng user.svg
```

Đây là cách xử lý rất phổ biến để tránh ảnh bị vỡ hoặc bị trống.

---

## 📁 8. `AsideFilter.tsx` — Sửa Lỗi Typing Và Tạo Search Params An Toàn Hơn

Commit này sửa:

```ts
type FormData = {
  price_min: string | undefined
  price_max: string | undefined
}
type FormOutput = Pick<Schema, 'price_max' | 'price_min'>
```

và:

```ts
const searchParams = Object.fromEntries(
  Object.entries({
    ...queryConfig,
    price_max: data.price_max,
    price_min: data.price_min
  }).filter(([, value]) => !isUndefined(value))
) as Record<string, string>
```

### Ý nghĩa

Khi tạo query string, nếu có field `undefined` mà vẫn đưa vào `createSearchParams`, rất dễ phát sinh dữ liệu không mong muốn.

Commit này lọc bỏ các giá trị `undefined` trước rồi mới tạo URL.

### Kết quả

URL lọc giá sẽ sạch hơn, ví dụ:

```text
/?price_min=100000&price_max=500000
```

thay vì có thể dính thêm các field rỗng / undefined.

---

## 📁 9. `index.html` Và `api-document.md`

### `index.html`

Đổi title:

```html
- <title>shopee-reactjs</title>
+ <title>Shopee Clone - ReactJS</title>
```

Giúp tên tab trình duyệt rõ ràng hơn.

### `api-document.md`

Commit này thêm file tài liệu API khá dài, mô tả:

- endpoint
- method
- body
- rules
- format response

File này hữu ích cho việc đối chiếu frontend với backend khi code form, auth, cart, upload avatar...

---

## 🔗 Luồng Hoạt Động Sau Commit

```text
1. User mở trang /user/profile
2. Form hiển thị đúng ngày sinh nhờ DateSelect đã được fix
3. User sửa thông tin và bấm Lưu
4. Frontend gọi API update profile
5. Server trả dữ liệu profile mới
6. AppContext và localStorage được cập nhật lại
7. Header và UserSideNav hiển thị avatar/email mới nhất
8. User thấy toast thông báo thành công
```

Commit này giúp phần Profile đi từ mức “hiển thị được data” sang mức “chỉnh sửa và lưu data thật”.

---

## 📌 Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **`useMutation`** | Hook của React Query dùng cho các hành động làm thay đổi dữ liệu như create / update / delete |
| **`mutateAsync`** | Phiên bản trả về Promise, có thể dùng `await` |
| **`toISOString()`** | Đổi đối tượng `Date` sang chuỗi ngày giờ chuẩn ISO để gửi lên backend |
| **Fallback image** | Ảnh dự phòng dùng khi dữ liệu ảnh thật không có |
| **Đồng bộ Context + Local Storage** | Sau khi update thành công, cập nhật cả state trong app lẫn dữ liệu lưu local |
| **Lọc `undefined` trước khi tạo query string** | Giúp URL sạch hơn và tránh bug do tham số rỗng |
