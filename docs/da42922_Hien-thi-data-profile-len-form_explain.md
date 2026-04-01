# da42922 — feat: Hiển thị data profile lên form

## 🎯 Tổng Quan

Commit này biến trang `Profile` từ giao diện tĩnh thành **form có dữ liệu thật**.

Những việc chính của commit:

1. Gọi API để lấy thông tin profile.
2. Đưa dữ liệu từ API vào form.
3. Kết nối các ô input với `react-hook-form`.
4. Tạo component `DateSelect` để chọn ngày sinh.
5. Thêm validation cho dữ liệu profile.

> 💡 Nói đơn giản: trước commit này form chỉ là khung giao diện. Sau commit này form đã hiện được dữ liệu thật của user.

---

## 📁 Tổng Quan Các File Thay Đổi

| File | Loại thay đổi | Vai trò |
|------|---------------|---------|
| `src/pages/User/pages/Profile/Profile.tsx` | Sửa lớn | Gọi API, đổ dữ liệu lên form, kết nối validation |
| `src/pages/User/components/DateSelect/DateSelect.tsx` | Tạo mới | Component chọn ngày sinh |
| `src/pages/User/components/DateSelect/index.ts` | Tạo mới | Export lại `DateSelect` |
| `src/utils/rules.ts` | Sửa | Thêm `userSchema` để validate form profile |
| `src/pages/User/components/UserSideNav/UserSideNav.tsx` | Sửa nhỏ | Dùng `path.historyPurchase` |
| `src/pages/ProductList/components/AsideFilter/AsideFilter.tsx` | Sửa nhỏ | Xóa import thừa |

---

## 📁 1. `Profile.tsx` — Từ Form Tĩnh Thành Form Có Data

### Trước commit này

Trang Profile chỉ mới có giao diện:

- Email đang hard-code
- Input chưa nối với form
- Chưa gọi API
- Chưa có dữ liệu thật từ backend

### Sau commit này

Trang Profile đã làm được các việc sau:

1. Gọi API lấy profile
2. Gắn input vào `react-hook-form`
3. Đổ data từ API lên form
4. Hiển thị lỗi validate nếu có

---

## 📁 2. Khai Báo Form Bằng `react-hook-form`

```ts
type FormData = Pick<UserSchema, 'name' | 'address' | 'phone' | 'date_of_birth' | 'avatar'>

const profileSchema = userSchema.pick(['name', 'address', 'phone', 'date_of_birth', 'avatar'])
```

### Ý nghĩa

Form Profile chỉ dùng 5 field:

- `name`
- `address`
- `phone`
- `date_of_birth`
- `avatar`

Nên tác giả lấy đúng 5 field này từ `userSchema` để dùng cho form hiện tại.

### Khởi tạo form:

```ts
const {
  register,
  control,
  formState: { errors },
  handleSubmit,
  setValue
} = useForm<FormData>({
  defaultValues: {
    name: '',
    phone: '',
    address: '',
    avatar: '',
    date_of_birth: new Date(1990, 0, 1)
  },
  resolver: yupResolver(profileSchema)
})
```

### Giải thích từng phần

| Biến / cấu hình | Ý nghĩa |
|-----------------|--------|
| `register` | Dùng để nối input thường vào form |
| `control` | Dùng cho các component custom qua `Controller` |
| `errors` | Chứa lỗi validate |
| `handleSubmit` | Bọc hàm submit |
| `setValue` | Gán dữ liệu vào form sau khi API trả về |
| `defaultValues` | Giá trị mặc định ban đầu |
| `resolver` | Kết nối `yup` với `react-hook-form` |

---

## 📁 3. Gọi API Lấy Profile

```ts
const { data: profileData } = useQuery({
  queryKey: ['profile'],
  queryFn: userApi.getProfile
})

const profile = profileData?.data.data
```

### Luồng chạy

```text
Profile component render
   ↓
useQuery gọi userApi.getProfile()
   ↓
Backend trả về thông tin user
   ↓
profileData có dữ liệu
   ↓
component render lại
```

### Vì sao dùng `useQuery`?

Vì dữ liệu profile đến từ server. `react-query` giúp việc gọi API gọn hơn và tự quản lý cache.

---

## 📁 4. Đổ Dữ Liệu Từ API Vào Form

```ts
useEffect(() => {
  if (profile) {
    setValue('name', profile.name)
    setValue('phone', profile.phone)
    setValue('address', profile.address)
    setValue('avatar', profile.avatar)
    setValue('date_of_birth', profile.date_of_birth ? new Date(profile.date_of_birth) : new Date(1990, 0, 1))
  }
}, [profile, setValue])
```

### Đây là đoạn rất quan trọng

Khi component chạy lần đầu, API chưa có dữ liệu nên form chỉ có `defaultValues`.

Sau khi API trả về `profile`, `useEffect` chạy và dùng `setValue(...)` để gán từng giá trị vào form.

### Minh họa:

```text
Lần render đầu:
name = ''
phone = ''
address = ''

API trả dữ liệu:
name = 'Nguyen Van A'
phone = '0987...'
address = 'HCM'

useEffect chạy:
setValue('name', ...)
setValue('phone', ...)
setValue('address', ...)
```

Nhờ vậy user sẽ thấy dữ liệu thật hiện lên trong form.

---

## 📁 5. Kết Nối Các Ô Input Với Form

### 5.1. Hiển thị email

```tsx
<div className='pt-3 text-gray-700'>{profile?.email}</div>
```

Email chỉ hiển thị ra text, không cho sửa.

### 5.2. `name`

```tsx
<Input
  register={register}
  name='name'
  placeholder='Tên'
  errorMessage={errors.name?.message}
/>
```

Input này được nối với form bằng `register`.

### 5.3. `address`

```tsx
<Input
  register={register}
  name='address'
  placeholder='Địa chỉ'
  errorMessage={errors.address?.message}
/>
```

Cách làm giống với `name`.

### 5.4. `phone` dùng `Controller`

```tsx
<Controller
  control={control}
  name='phone'
  render={({ field }) => (
    <InputNumber
      {...field}
      onChange={field.onChange}
      errorMessage={errors.phone?.message}
    />
  )}
/>
```

Vì `InputNumber` là component custom, nên không dùng `register` trực tiếp như input thường. Do đó phải dùng `Controller`.

### Hiểu đơn giản:

```text
Input thường      → dùng register
Input custom      → hay dùng Controller
```

---

## 📁 6. `DateSelect.tsx` — Tạo Component Chọn Ngày Sinh

Commit này tạo mới file:

```text
src/pages/User/components/DateSelect/DateSelect.tsx
```

Component này thay cho phần 3 ô select ngày / tháng / năm viết cứng trước đó.

### Props của component:

```ts
interface Props {
  onChange: (value: Date) => void
  value?: Date
  errorMessage?: string
}
```

### Ý nghĩa:

| Props | Vai trò |
|-------|--------|
| `value` | Giá trị ngày hiện tại |
| `onChange` | Báo ngược dữ liệu về form khi user thay đổi |
| `errorMessage` | Hiển thị lỗi validate |

### State bên trong component:

```ts
const [date, setDate] = useState({
  date: value?.getDate() || 1,
  month: value?.getMonth() || 0,
  year: value?.getFullYear() || 1990
})
```

Component lưu tạm:

- ngày
- tháng
- năm

Khi user đổi một giá trị, component sẽ ghép lại thành một object `Date`.

### Hàm `handleChange`

```ts
const newDate = {
  ...date,
  [name]: value
}
setDate(newDate)
onChange(new Date(newDate.year, newDate.month, newDate.date))
```

### Luồng hoạt động

```text
User đổi ngày hoặc tháng hoặc năm
   ↓
DateSelect cập nhật state bên trong
   ↓
DateSelect tạo ra Date mới
   ↓
Gửi Date mới lên form qua onChange
```

### Trong `Profile.tsx`, `DateSelect` được dùng như sau:

```tsx
<Controller
  control={control}
  name='date_of_birth'
  render={({ field }) => (
    <DateSelect
      errorMessage={errors.date_of_birth?.message}
      value={field.value}
      onChange={field.onChange}
    />
  )}
/>
```

---

## 📁 7. `src/utils/rules.ts` — Thêm Validation Cho User

```ts
export const userSchema = yup.object({
  name: yup.string().max(160, 'Độ dài tối đa là 160 ký tự'),
  phone: yup.string().max(20, 'Độ dài tối đa là 20 ký tự'),
  address: yup.string().max(160, 'Độ dài tối đa là 160 ký tự'),
  avatar: yup.string().max(1000, 'Độ dài tối đa là 1000 ký tự'),
  date_of_birth: yup.date().max(new Date(), 'Hãy chọn một ngày trong quá khứ'),
  password: schema.fields['password'],
  confirmPassword: schema.fields['password'],
  newPassword: schema.fields['confirm_password']
})
```

### File này thêm gì?

Commit này tạo `userSchema` để validate dữ liệu liên quan đến user.

Riêng form Profile hiện tại chỉ lấy một phần:

```ts
const profileSchema = userSchema.pick(['name', 'address', 'phone', 'date_of_birth', 'avatar'])
```

### Nghĩa là:

`userSchema` là schema lớn, còn `profileSchema` là schema nhỏ dành riêng cho form Profile.

### Ví dụ validate:

- `name` dài tối đa 160 ký tự
- `phone` dài tối đa 20 ký tự
- `date_of_birth` phải là ngày trong quá khứ

---

## 📁 8. Những Sửa Đổi Nhỏ Khác

### `UserSideNav.tsx`

```tsx
- <Link to={path.hitoryPurchase} ...>
+ <Link to={path.historyPurchase} ...>
```

Đồng bộ với commit trước khi tên route được sửa lại.

### `AsideFilter.tsx`

```tsx
- import InputV2 from '~/components/InputV2'
```

Xóa import thừa vì không còn sử dụng.

---

## 🔗 Luồng Hoạt Động Sau Commit

```text
1. User mở trang /user/profile
2. useQuery gọi API lấy profile
3. API trả dữ liệu user
4. useEffect dùng setValue để gán dữ liệu vào form
5. Input, InputNumber, DateSelect hiển thị dữ liệu thật
6. User có thể sửa dữ liệu và bấm nút Lưu
```

> ⚠️ Ở commit này, nút `Lưu` mới chỉ `console.log(data)` chứ chưa gọi API update thật. Nghĩa là commit này tập trung vào phần **hiển thị data lên form**.

---

## 📌 Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **`useQuery`** | Hook của React Query dùng để gọi API lấy dữ liệu |
| **`useForm`** | Hook của React Hook Form dùng để quản lý form |
| **`setValue`** | Hàm dùng để gán dữ liệu vào field của form |
| **`Controller`** | Dùng để kết nối các component custom với `react-hook-form` |
| **`yupResolver`** | Giúp `react-hook-form` dùng được validation của `yup` |
| **Schema `.pick()`** | Lấy ra một phần field từ schema lớn |
