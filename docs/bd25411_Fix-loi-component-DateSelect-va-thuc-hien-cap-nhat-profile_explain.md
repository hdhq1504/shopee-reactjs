# bd25411 — fix: Fix lỗi component DateSelect và thực hiện cập nhật profile

## 🎯 Tổng Quan

Commit này sửa và hoàn thiện phần **Profile** thêm một bước nữa. Có 4 ý chính:

1. Sửa lỗi component `DateSelect` để chọn đúng ngày / tháng / năm.
2. Nối form Profile với API update thật, không còn chỉ `console.log`.
3. Hiển thị avatar và email thật của user ở `NavHeader` và `UserSideNav`.
4. Sửa một lỗi typing ở `AsideFilter` khi tạo query string lọc giá.

> 💡 Nếu commit trước mới dừng ở bước "đổ dữ liệu lên form", thì commit này đi tiếp bước "bấm Lưu để cập nhật profile thật".

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

---

## 📁 1. `DateSelect.tsx` — Sửa Lỗi Chọn Sai Tháng Và Năm

### Lỗi cũ là gì?

Ở commit trước, cả 3 ô select `ngày`, `tháng`, `năm` đều có chung một vấn đề:

```tsx
// TRƯỚC — BUG: cả 3 select đều dùng name='date'
<select name='date' value={value?.getDate() || date.date} ...>  {/* Ngày ✅ */}
<select name='date' value={value?.getDate() || date.date} ...>  {/* Tháng ❌ — nhầm! */}
<select name='date' value={value?.getDate() || date.date} ...>  {/* Năm ❌ — nhầm! */}
```

Điều đó dẫn đến:

```
User đổi ô "Tháng" từ 3 sang 8
   ↓
event.target.name vẫn là 'date'
   ↓
handleChange hiểu đang đổi ngày thay vì tháng
   ↓
Ngày sinh bị sai hoàn toàn
```

### Commit này sửa gì?

#### Sửa 1: `name` của từng select khác nhau

```tsx
// SAU — mỗi select có name riêng
<select name='date' ...>   {/* Ngày */}
<select name='month' ...>  {/* Tháng */}
<select name='year' ...>   {/* Năm */}
```

#### Sửa 2: `value` cho đúng field

```tsx
// Ngày — dùng getDate()
value={value?.getDate() || date.date}

// Tháng — dùng getMonth() + toán tử ??
value={value?.getMonth() ?? date.month}

// Năm — dùng getFullYear() + toán tử ??
value={value?.getFullYear() ?? date.year}
```

#### ⭐ Tại sao `month` và `year` dùng `??` thay vì `||`?

Đây là một bug rất tinh vi:

| Toán tử | Trả về vế phải khi vế trái là... |
|---------|----------------------------------|
| `\|\|` | `false`, `0`, `""`, `null`, `undefined` |
| `??` | Chỉ `null`, `undefined` |

Mà `getMonth()` trả về **`0`** cho tháng 1 (JavaScript đếm tháng từ 0). Nếu dùng `||`:

```typescript
value?.getMonth() || date.month
// Tháng 1: getMonth() = 0 (falsy!) → || sẽ lấy date.month thay vì 0
// → Hiển thị sai tháng!

value?.getMonth() ?? date.month
// Tháng 1: getMonth() = 0 (nhưng không phải null/undefined) → ?? giữ nguyên 0
// → Hiển thị đúng tháng 1 ✅
```

> 💡 **Bài học:** Khi giá trị hợp lệ có thể là `0` hoặc `""`, luôn dùng `??` thay vì `||`.

#### Sửa 3: `handleChange` — Computed Property Name

```typescript
const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
  const { value: valueFromSelect, name } = event.target
  const newDate = {
    date: value?.getDate() || date.date,     // Giữ nguyên ngày
    month: value?.getMonth() || date.month,   // Giữ nguyên tháng
    year: value?.getFullYear() || date.year,   // Giữ nguyên năm
    [name]: Number(valueFromSelect)            // ← CHỈ GHI ĐÈ field đang thay đổi
  }
  setDate(newDate)
  onChange && onChange(new Date(newDate.year, newDate.month, newDate.date))
}
```

**`[name]` là kỹ thuật gì?** — **Computed Property Name** trong JavaScript:

```typescript
const name = 'month'
const obj = { [name]: 8 }
// Tương đương: { month: 8 }
```

Khi user đổi ô "Tháng" sang tháng 8:
1. `name = 'month'`, `valueFromSelect = '7'` (vì JS đếm từ 0)
2. `newDate` ban đầu giữ nguyên date và year cũ
3. `[name]: Number(valueFromSelect)` → ghi đè `month: 7`
4. Tạo `new Date(2001, 7, 15)` → 15/08/2001 ✅

#### Sửa 4: `useEffect` đồng bộ state nội bộ

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

**Tại sao cần?** `DateSelect` có state nội bộ `date`, nhưng giá trị thật đến từ prop `value`. Khi bên ngoài thay đổi `value` (ví dụ: API trả ngày sinh), `useEffect` đồng bộ lại state nội bộ để 3 ô select hiển thị đúng.

```
API trả ngày sinh = "2001-10-15"
   ↓
Profile dùng setValue('date_of_birth', new Date('2001-10-15'))
   ↓
DateSelect nhận prop value mới
   ↓
useEffect chạy → setDate({ date: 15, month: 9, year: 2001 })
   ↓
3 ô select hiển thị: Ngày 15 / Tháng 10 / Năm 2001 ✅
```

---

## 📁 2. `Profile.tsx` — Thực Hiện Cập Nhật Profile Thật

Đây là phần quan trọng nhất của commit.

### Trước commit này

Khi user bấm `Lưu`, code chỉ `console.log(data)` — form lấy được dữ liệu nhưng chưa gửi lên server.

### Sau commit — Thêm mutation và xử lý submit hoàn chỉnh

```typescript
const updateProfileMutation = useMutation({
  mutationFn: userApi.updateProfile
})
```

```typescript
const onSubmit = handleSubmit(async (data) => {
  const res = await updateProfileMutation.mutateAsync({
    ...data,
    date_of_birth: data.date_of_birth?.toISOString()   // Date → chuỗi ISO
  })
  setProfile(res.data.data)          // Cập nhật Context
  setProfileToLS(res.data.data)      // Cập nhật localStorage
  refetch()                          // Gọi lại API getProfile
  toast.success(res.data.message)    // Thông báo thành công
})
```

### Giải thích từng bước

#### Bước 1: `handleSubmit(async (data) => {...})`

`handleSubmit` của react-hook-form chỉ gọi callback khi form **pass validation**. Biến `data` chứa dữ liệu đã validate thành công.

#### Bước 2: `mutateAsync` thay vì `mutate`

```typescript
const res = await updateProfileMutation.mutateAsync({...})
```

Dùng `mutateAsync` + `await` để **chờ kết quả** từ server trước khi chạy các bước tiếp theo. Nếu dùng `mutate` thì không chờ được.

#### Bước 3: `date_of_birth?.toISOString()`

Trong form, `date_of_birth` là kiểu `Date` (object JavaScript). Nhưng API cần chuỗi:

```
new Date(2001, 9, 15).toISOString()
→ "2001-10-15T00:00:00.000Z"
```

#### Bước 4: Cập nhật Context + localStorage

```typescript
setProfile(res.data.data)       // AppContext cập nhật → NavHeader, SideNav re-render
setProfileToLS(res.data.data)   // localStorage lưu → reload trang vẫn giữ data mới
```

Hai bước này đảm bảo profile mới nhất được phản ánh ở **mọi nơi** ngay lập tức.

#### Bước 5: `refetch()`

Gọi lại API `getProfile` để chắc chắn dữ liệu từ server đã đồng bộ 100%.

---

### `FormInput` vs `FormData` — Tách Kiểu Dữ Liệu Input/Output

```typescript
type FormInput = {
  name: string | undefined
  phone: string | undefined
  address: string | undefined
  avatar: string | undefined
  date_of_birth: Date | undefined       // ← Date object trong form
}

type FormData = Pick<UserSchema, 'name' | 'address' | 'phone' | 'date_of_birth' | 'avatar'>

useForm<FormInput, unknown, FormData>({...})
//       ↑ Input type    ↑ Output type (sau validate)
```

**Tại sao tách?** `date_of_birth` trong form là `Date`, nhưng sau khi validate (qua yup schema), nó có thể thành kiểu khác. TypeScript generic `<FormInput, unknown, FormData>` cho react-hook-form hiểu:
- Khi gõ → dữ liệu theo `FormInput`
- Khi submit thành công → dữ liệu theo `FormData`

---

## 📁 3. `user.api.ts` và `rules.ts` — Đồng Bộ Tên Field Với Backend

### Thay đổi:

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

### Tại sao?

Backend API dùng **snake_case** (`new_password`, `confirm_password`). Nếu frontend dùng **camelCase** (`newPassword`), khi gửi request lên server sẽ bị **lệch tên field** → server không nhận ra → dữ liệu bị mất.

> 💡 **Bài học:** Frontend nên match tên field với API. Nếu backend dùng snake_case → frontend cũng dùng snake_case cho data layer.

---

## 📁 4. `NavHeader.tsx` + `UserSideNav.tsx` — Hiển Thị Avatar Thật

### Trước: Avatar cứng (hardcoded URL)
```tsx
src='https://cf.shopee.vn/file/d04ea22afab6e6d250a370d7ccc2e675_tn'
```

### Sau: Avatar dynamic + fallback
```tsx
import userImage from '~/assets/images/user.svg'

<img src={profile?.avatar || userImage} alt='avatar' />
```

| `profile?.avatar` | Kết quả |
|-------------------|---------|
| Có avatar thật (URL) | → Hiển thị avatar của user |
| `undefined` / `null` / `""` | → Hiển thị `user.svg` (ảnh mặc định) |

**`user.svg`** là file SVG mới được thêm vào `src/assets/images/` — ảnh silhouette người dùng mặc định, tránh bị vỡ ảnh hoặc trống.

---

## 📁 5. `AsideFilter.tsx` — Sửa Lỗi Tạo Search Params

### Vấn đề: `undefined` lọt vào URL

Khi `price_min` hoặc `price_max` là `undefined`, nếu nhét thẳng vào `createSearchParams` sẽ tạo URL lỗi:

```
/?price_min=undefined&price_max=500000   ← BUG
```

### Giải pháp: Lọc bỏ `undefined` trước khi tạo URL

```typescript
type FormData = {
  price_min: string | undefined      // ← Có thể undefined
  price_max: string | undefined
}

const searchParams = Object.fromEntries(
  Object.entries({
    ...queryConfig,
    price_max: data.price_max,
    price_min: data.price_min
  }).filter(([, value]) => !isUndefined(value))     // ← Lọc bỏ undefined
) as Record<string, string>
```

**Giải thích pipeline:**

```
{ ...queryConfig, price_min: '100000', price_max: undefined }
   ↓ Object.entries()
[['page', '1'], ['price_min', '100000'], ['price_max', undefined]]
   ↓ .filter(([, value]) => !isUndefined(value))
[['page', '1'], ['price_min', '100000']]             ← Bỏ price_max
   ↓ Object.fromEntries()
{ page: '1', price_min: '100000' }                   ← Object sạch

→ URL kết quả: /?page=1&price_min=100000             ← Không có field rỗng ✅
```

---

## 🔗 Luồng Hoạt Động Sau Commit

```
1. User mở trang /user/profile
2. API getProfile trả data → useEffect fill form (name, phone, date_of_birth...)
3. DateSelect hiển thị đúng ngày sinh nhờ đã fix name/value/useEffect
4. User sửa thông tin và bấm [Lưu]
5. handleSubmit validate → mutateAsync gọi API updateProfile
6. Server trả profile mới → cập nhật Context + localStorage + refetch
7. NavHeader và UserSideNav hiển thị avatar/email mới ngay lập tức
8. Toast "Cập nhật thành công!" 🎉
```

---

## 📌 Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **`??` vs `\|\|`** | `??` chỉ fallback khi `null`/`undefined`. `\|\|` fallback cả `0`, `""`, `false`. Dùng `??` khi `0` là giá trị hợp lệ |
| **Computed Property Name `[name]`** | Dùng biến làm key trong object: `{ [name]: value }` → key là giá trị của biến `name` |
| **`mutateAsync` + `await`** | Phiên bản trả Promise của `mutate`, dùng khi cần chờ kết quả trước khi tiếp tục |
| **`toISOString()`** | Đổi `Date` object → chuỗi ngày chuẩn quốc tế để gửi API |
| **Fallback image pattern** | `profile?.avatar \|\| defaultImage` — ảnh dự phòng khi data trống |
| **Lọc `undefined` trước `createSearchParams`** | Tránh URL dính `undefined` — dùng `Object.entries().filter()` |
| **Đồng bộ Context + localStorage** | Sau khi update → cập nhật cả React state lẫn persistent storage |
