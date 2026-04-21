# bd25411 — fix: Fix lỗi component DateSelect và thực hiện cập nhật profile

## Tổng Quan

Commit này sửa và hoàn thiện phần Profile thêm một bước nữa. Có 4 ý chính:

1. Sửa lỗi component `DateSelect` — trước đây cả 3 ô select dùng chung `name='date'`, gây sai tháng và năm khi đổi giá trị.
2. Nối form Profile với API update thật — trước đó nút Lưu chỉ `console.log`.
3. Hiển thị avatar và email thật của user ở `NavHeader` và `UserSideNav`.
4. Sửa lỗi `undefined` lọt vào URL khi lọc giá sản phẩm trong `AsideFilter`.

---

## Các File Thay Đổi

| File | Loại thay đổi | Vai trò |
|------|---------------|---------|
| `src/pages/User/components/DateSelect/DateSelect.tsx` | Sửa | Fix logic chọn ngày sinh |
| `src/pages/User/pages/Profile/Profile.tsx` | Sửa lớn | Gọi API update profile thật |
| `src/apis/user.api.ts` | Sửa | Đổi `newPassword` → `new_password` cho đúng format API |
| `src/utils/rules.ts` | Sửa | Đồng bộ tên field schema theo backend |
| `src/components/NavHeader/NavHeader.tsx` | Sửa | Hiển thị avatar thật hoặc ảnh mặc định |
| `src/pages/User/components/UserSideNav/UserSideNav.tsx` | Sửa | Hiển thị avatar và email thật |
| `src/assets/images/user.svg` | Tạo mới | Ảnh silhouette mặc định khi user chưa có avatar |
| `src/pages/ProductList/components/AsideFilter/AsideFilter.tsx` | Sửa | Fix URL có `undefined` khi lọc giá |
| `index.html` | Sửa nhỏ | Đổi tiêu đề tab trình duyệt |

---

## 1. `DateSelect.tsx` — Sửa Lỗi Chọn Sai Tháng Và Năm

### Lỗi cụ thể là gì?

Ở commit `da42922` trước, cả 3 ô select `ngày`, `tháng`, `năm` đều dùng chung `name='date'`:

```tsx
// TRƯỚC — BUG: cả 3 select đều có name='date'
<select name='date' value={value?.getDate() || date.date} ...>   {/* Ngày ✅ */}
<select name='date' value={value?.getDate() || date.date} ...>   {/* Tháng ❌ — nhầm name và value */}
<select name='date' value={value?.getDate() || date.date} ...>   {/* Năm ❌ — nhầm name và value */}
```

Hậu quả khi user đổi ô "Tháng":

```
event.target.name = 'date'       ← Giống tên của ô Ngày!
event.target.value = '8'         ← Tháng 8

handleChange nhìn vào name='date' → nghĩ đang đổi Ngày thành 8
→ Date object: new Date(2001, 0, 8) = 8/1/2001  ← Sai!
Đáng ra phải là: new Date(2001, 7, 15) = 15/8/2001
```

### Sửa 1: Mỗi select có `name` riêng biệt

```tsx
// SAU — mỗi select có name riêng
<select name='date' ...>    {/* Ngày */}
<select name='month' ...>   {/* Tháng */}
<select name='year' ...>    {/* Năm */}
```

### Sửa 2: `value` đọc đúng field

```tsx
// Ngày — dùng getDate() → trả về ngày (1-31)
value={value?.getDate() || date.date}

// Tháng — dùng getMonth() → trả về tháng (0-11)
value={value?.getMonth() ?? date.month}

// Năm — dùng getFullYear() → trả về năm đầy đủ (2001)
value={value?.getFullYear() ?? date.year}
```

### Tại sao `month` và `year` dùng `??` thay vì `||`?

Đây là một bug rất tinh vi liên quan đến **JavaScript đếm tháng từ 0**:

| Toán tử | Trả về vế phải khi vế trái là... |
|---------|----------------------------------|
| `\|\|` | `false`, `0`, `""`, `null`, `undefined` |
| `??` | Chỉ `null` và `undefined` |

`getMonth()` trả về `0` cho tháng 1. Nếu dùng `||`:

```typescript
value?.getMonth() || date.month
// User chọn tháng 1: getMonth() = 0 (falsy!)
// → || lấy date.month thay vì 0 → hiển thị tháng sai!

value?.getMonth() ?? date.month
// User chọn tháng 1: getMonth() = 0 (không phải null/undefined)
// → ?? giữ nguyên 0 → hiển thị đúng tháng 1 ✅
```

**Bài học:** Khi giá trị hợp lệ có thể là `0` hoặc `""`, luôn dùng `??` thay vì `||`.

### Sửa 3: `handleChange` dùng Computed Property Name

```typescript
const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
  const { value: valueFromSelect, name } = event.target
  const newDate = {
    date: value?.getDate() || date.date,
    month: value?.getMonth() || date.month,
    year: value?.getFullYear() || date.year,
    [name]: Number(valueFromSelect)   // CHỈ GHI ĐÈ field đang thay đổi
  }
  setDate(newDate)
  onChange && onChange(new Date(newDate.year, newDate.month, newDate.date))
}
```

Khi user đổi ô Tháng sang tháng 8:
1. `name = 'month'`, `valueFromSelect = '7'` (tháng 8 = index 7 trong JS)
2. `newDate` ban đầu giữ nguyên `date` và `year` cũ
3. `[name]: Number(valueFromSelect)` → ghi đè `month: 7`
4. `new Date(2001, 7, 15)` = 15/08/2001 ✅

### Sửa 4: `useEffect` đồng bộ state nội bộ

```typescript
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

**Tại sao cần?** `DateSelect` có state nội bộ `{date, month, year}` nhưng giá trị thật đến từ prop `value` (Date object). Khi bên ngoài thay đổi `value` (ví dụ: API trả ngày sinh về form), `useEffect` đồng bộ state nội bộ để 3 ô select hiển thị đúng giá trị mới.

```
API trả: date_of_birth = "2001-10-15"
    ↓
Profile.tsx: setValue('date_of_birth', new Date('2001-10-15'))
    ↓
DateSelect nhận prop value = Date(2001, 9, 15) mới
    ↓
useEffect chạy → setDate({ date: 15, month: 9, year: 2001 })
    ↓
3 ô select hiển thị: Ngày 15 / Tháng 10 / Năm 2001 ✅
```

---

## 2. `Profile.tsx` — Thực Hiện Cập Nhật Profile Thật

### Trước commit này

Khi user bấm `Lưu`, code chỉ `console.log(data)` — form lấy được dữ liệu nhưng chưa gửi lên server.

### Thêm mutation và xử lý submit hoàn chỉnh

```typescript
const updateProfileMutation = useMutation({
  mutationFn: userApi.updateProfile
})
```

```typescript
const onSubmit = handleSubmit(async (data) => {
  const res = await updateProfileMutation.mutateAsync({
    ...data,
    date_of_birth: data.date_of_birth?.toISOString()   // Date object → chuỗi ISO
  })
  setProfile(res.data.data)          // Cập nhật AppContext → UI re-render
  setProfileToLS(res.data.data)      // Cập nhật localStorage → reload vẫn giữ
  refetch()                          // Gọi lại API getProfile để đồng bộ 100%
  toast.success(res.data.message)    // Thông báo thành công
})
```

### Giải thích từng bước

**Bước 1: `handleSubmit(callback)`** — chỉ gọi `callback` khi form **pass validation** (Yup schema). Nếu có field lỗi, form hiển thị lỗi và dừng lại.

**Bước 2: `mutateAsync` thay vì `mutate`**

`mutate` là fire-and-forget — không trả Promise, không chờ kết quả. `mutateAsync` trả Promise — dùng `await` để chờ server phản hồi trước khi chạy các bước tiếp theo.

Ở đây ta CẦN kết quả từ server (profile mới nhất) để cập nhật Context và localStorage → bắt buộc dùng `mutateAsync`.

**Bước 3: `toISOString()`**

```typescript
new Date(2001, 9, 15).toISOString()
// → "2001-10-15T00:00:00.000Z"
```

API cần chuỗi ngày chuẩn ISO 8601, không phải Date object. `.toISOString()` chuyển đổi.

**Bước 4: Cập nhật cả Context lẫn localStorage**

```typescript
setProfile(res.data.data)       // AppContext → NavHeader, SideNav re-render ngay
setProfileToLS(res.data.data)   // localStorage → reload trang vẫn giữ data mới
```

Nếu chỉ cập nhật Context mà không cập nhật localStorage → khi user reload trang, app đọc localStorage cũ → mất thay đổi.

**Bước 5: `refetch()`**

Gọi lại API `getProfile` để chắc chắn dữ liệu trong cache của React Query đồng bộ với server.

### `FormInput` vs `FormData` — Tách Kiểu Dữ Liệu Input/Output

```typescript
type FormInput = {
  name: string | undefined
  phone: string | undefined
  address: string | undefined
  avatar: string | undefined
  date_of_birth: Date | undefined   // Date object trong form (trước validate)
}

type FormData = Pick<UserSchema, 'name' | 'address' | 'phone' | 'date_of_birth' | 'avatar'>
// date_of_birth ở đây theo type của Yup schema sau validate

useForm<FormInput, unknown, FormData>({...})
//       ↑ Input type     ↑ Output type (sau validate)
```

Generic `<TFieldValues, TContext, TTransformedValues>` cho React Hook Form biết:
- Khi user đang nhập → dữ liệu theo `FormInput`
- Khi submit thành công → dữ liệu theo `FormData` (đã qua Yup transform)

---

## 3. `user.api.ts` và `rules.ts` — Đồng Bộ Tên Field Với Backend

```diff
// user.api.ts
- newPassword?: string
+ new_password?: string

// rules.ts
- confirmPassword
+ confirm_password
- newPassword
+ new_password
```

### Tại sao quan trọng?

Backend API dùng **snake_case** (`new_password`, `confirm_password`). Nếu frontend dùng **camelCase** (`newPassword`), khi gửi request, body JSON sẽ là:

```json
{
  "newPassword": "abc123"   ← Server không nhận ra field này!
}
```

Thay vì phải là:

```json
{
  "new_password": "abc123"  ← Đúng tên field server mong đợi
}
```

Server không tìm thấy `new_password` trong body → không update password → lỗi thầm lặng (không báo lỗi nhưng cũng không thay đổi gì). Đây là loại bug khó debug vì không có error rõ ràng.

---

## 4. `NavHeader.tsx` + `UserSideNav.tsx` — Hiển Thị Avatar Thật

### Trước: Avatar hardcoded URL

```tsx
src='https://cf.shopee.vn/file/d04ea22afab6e6d250a370d7ccc2e675_tn'
// Mọi user đều thấy cùng một ảnh avatar - hiển nhiên là sai
```

### Sau: Avatar động với ảnh dự phòng

```tsx
import userImage from '~/assets/images/user.svg'

<img src={profile?.avatar || userImage} alt='avatar' />
```

| `profile?.avatar` | Kết quả hiển thị |
|-------------------|-----------------|
| Có giá trị (URL ảnh) | Avatar thật của user |
| `undefined`, `null`, hoặc `""` | `user.svg` (ảnh silhouette mặc định) |

`user.svg` là file SVG silhouette người dùng — nhẹ, scale tốt mọi kích thước, và không bao giờ bị lỗi 404.

---

## 5. `AsideFilter.tsx` — Sửa Lỗi `undefined` Lọt Vào URL

### Vấn đề

Khi `price_min` hoặc `price_max` không được nhập, giá trị là `undefined`. Nếu nhét thẳng vào `createSearchParams`:

```
URL kết quả: /?price_min=undefined&price_max=500000
                            ↑ Không mong muốn!
```

### Giải pháp: Lọc bỏ `undefined` trước khi tạo URL

```typescript
const searchParams = Object.fromEntries(
  Object.entries({
    ...queryConfig,
    price_max: data.price_max,    // Có thể undefined
    price_min: data.price_min     // Có thể undefined
  }).filter(([, value]) => !isUndefined(value))   // Lọc bỏ các entry có value undefined
) as Record<string, string>
```

Phân tích từng bước:

```
Input: { page: '1', price_min: '100000', price_max: undefined }
    ↓ Object.entries()
[['page', '1'], ['price_min', '100000'], ['price_max', undefined]]
    ↓ .filter(([, value]) => !isUndefined(value))
[['page', '1'], ['price_min', '100000']]   ← Bỏ price_max
    ↓ Object.fromEntries()
{ page: '1', price_min: '100000' }         ← Object sạch

URL kết quả: /?page=1&price_min=100000    ✅ Không có field rỗng
```

---

## Luồng Hoạt Động Sau Commit

```
1. User mở /user/profile
2. API getProfile trả data
3. useEffect fill form (name, phone, date_of_birth...)
4. DateSelect hiển thị đúng ngày sinh (đã fix name/value/useEffect)
5. User sửa thông tin, bấm [Lưu]
6. handleSubmit validate → mutateAsync gọi API updateProfile
7. Server trả profile mới
8. Cập nhật AppContext + localStorage + refetch()
9. NavHeader và UserSideNav hiển thị avatar/email mới ngay lập tức
10. Toast "Cập nhật thành công!"
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **`??` vs `\|\|`** | `??` chỉ fallback khi `null` hoặc `undefined`. `\|\|` fallback cả `0`, `""`, `false`. Dùng `??` khi `0` là giá trị hợp lệ (như index tháng trong JS). |
| **Computed Property Name `[name]`** | Dùng giá trị biến làm key trong object: `{ [name]: value }`. Thay thế cho nhiều `if/else` riêng lẻ. |
| **`mutateAsync` + `await`** | Phiên bản trả Promise của `mutate`. Dùng khi cần chờ server phản hồi trước khi thực hiện bước tiếp theo. |
| **`toISOString()`** | Chuyển `Date` object → chuỗi ISO 8601. Bắt buộc để gửi ngày tháng lên API vì server không nhận Date object JavaScript. |
| **Fallback image pattern** | `profile?.avatar \|\| defaultImage` — hiển thị ảnh mặc định khi user chưa có avatar. Tránh ảnh vỡ hoặc khoảng trống. |
| **Lọc `undefined` trước `createSearchParams`** | `Object.entries().filter()` loại bỏ các field có value `undefined` — tránh URL bị ô nhiễm với `?field=undefined`. |
| **Đồng bộ Context + localStorage** | Sau khi update thành công → cập nhật cả React state (AppContext) lẫn persistent storage (localStorage) để đảm bảo nhất quán cả khi đang dùng lẫn khi reload. |
| **snake_case vs camelCase** | API thường dùng snake_case (`new_password`). Frontend phải match tên field với server, nếu không request sẽ gửi sai tên field và server không nhận ra. |
