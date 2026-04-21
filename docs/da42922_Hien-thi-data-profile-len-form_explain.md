# da42922 — feat: Hiển thị data profile lên form

## Tổng Quan

Commit này biến trang `Profile` từ giao diện tĩnh (chỉ có UI) thành **form có dữ liệu thật từ server**. Có 4 ý chính:

1. Gọi API để lấy thông tin profile của user đang đăng nhập.
2. Đổ dữ liệu từ API vào từng ô input trong form.
3. Kết nối các ô input với `react-hook-form` (kiểm soát giá trị và validate).
4. Tạo component `DateSelect` chuyên dùng để chọn ngày sinh.

Lưu ý quan trọng: commit này chỉ tập trung vào **đọc và hiển thị** dữ liệu. Nút "Lưu" vẫn chỉ `console.log` — chưa gọi API update thật (phần đó sẽ làm ở commit `bd25411`).

---

## Các File Thay Đổi

| File | Loại thay đổi | Vai trò |
|------|---------------|---------|
| `src/pages/User/pages/Profile/Profile.tsx` | Sửa lớn | Gọi API, đổ dữ liệu lên form, kết nối validation |
| `src/pages/User/components/DateSelect/DateSelect.tsx` | Tạo mới | Component chọn ngày / tháng / năm sinh |
| `src/pages/User/components/DateSelect/index.ts` | Tạo mới | Barrel export |
| `src/utils/rules.ts` | Sửa | Thêm `userSchema` để validate form profile |
| `src/pages/User/components/UserSideNav/UserSideNav.tsx` | Sửa nhỏ | Dùng `path.historyPurchase` đã sửa chính tả |
| `src/pages/ProductList/components/AsideFilter/AsideFilter.tsx` | Sửa nhỏ | Xóa import thừa |

---

## 1. Khai Báo Form Bằng `react-hook-form`

### Tạo schema validate chỉ cho form Profile

Form Profile chỉ cần validate 5 field, không cần toàn bộ `userSchema`:

```typescript
type FormData = Pick<UserSchema, 'name' | 'address' | 'phone' | 'date_of_birth' | 'avatar'>

const profileSchema = userSchema.pick(['name', 'address', 'phone', 'date_of_birth', 'avatar'])
```

**`Pick<UserSchema, 'name' | 'address' | ...>`** — TypeScript utility type, lấy ra đúng những field cần dùng từ schema lớn hơn. Tương tự, **`userSchema.pick([...])`** tạo Yup schema nhỏ hơn chỉ validate những field được chỉ định.

Lợi ích: tránh validate những field không có trong form (như `password`, `new_password`) gây lỗi không cần thiết.

### Khởi tạo form với `useForm`

```typescript
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
    date_of_birth: new Date(1990, 0, 1)  // Mặc định: 1/1/1990
  },
  resolver: yupResolver(profileSchema)    // Kết nối Yup với React Hook Form
})
```

Giải thích từng thứ lấy ra từ `useForm`:

| Biến | Kiểu | Dùng để |
|------|------|---------|
| `register` | Function | Nối input HTML thông thường vào form |
| `control` | Object | Nối component custom (không phải input thuần HTML) vào form |
| `errors` | Object | Chứa thông báo lỗi của từng field |
| `handleSubmit` | Function | Bọc hàm xử lý submit, tự validate trước khi gọi callback |
| `setValue` | Function | **Gán giá trị vào form từ bên ngoài** — dùng khi API trả data về |

`defaultValues` là giá trị ban đầu khi form chưa có dữ liệu từ API. `resolver: yupResolver(profileSchema)` kết nối Yup schema với React Hook Form để tự động validate khi submit.

---

## 2. Gọi API Lấy Profile

```typescript
const { data: profileData } = useQuery({
  queryKey: ['profile'],
  queryFn: userApi.getProfile
})

const profile = profileData?.data.data
```

**`useQuery`** từ TanStack Query tự động gọi hàm `userApi.getProfile()` và quản lý trạng thái (loading, success, error). Khi API trả về dữ liệu, component tự động re-render.

**`profileData?.data.data`** — Cấu trúc response lồng nhiều tầng:
- `profileData` — response object của Axios
- `.data` — response body từ server (kiểu `SuccessResponse<User>`)
- `.data` thứ 2 — field `data` trong `SuccessResponse`, chứa `User` object thật

```
Axios response:
{
  data: {               ← .data (HTTP response body)
    message: "...",
    data: {             ← .data.data (User object thật)
      _id: "...",
      name: "Nguyen Van A",
      email: "..."
    }
  }
}
```

---

## 3. Đổ Dữ Liệu Từ API Vào Form — `useEffect` + `setValue`

```typescript
useEffect(() => {
  if (profile) {
    setValue('name', profile.name)
    setValue('phone', profile.phone)
    setValue('address', profile.address)
    setValue('avatar', profile.avatar)
    setValue(
      'date_of_birth',
      profile.date_of_birth ? new Date(profile.date_of_birth) : new Date(1990, 0, 1)
    )
  }
}, [profile, setValue])
```

### Tại sao cần `useEffect` + `setValue` thay vì dùng `defaultValues`?

**`defaultValues`** chỉ được đọc **một lần** khi `useForm` khởi tạo, tức là khi component mount lần đầu. Lúc đó API chưa trả về data nên `profile` còn là `undefined`.

Sau đó API trả data → `profile` có giá trị → component re-render. Nhưng `defaultValues` không được đọc lại nữa — form vẫn hiện giá trị rỗng.

**`setValue`** là hàm cho phép gán giá trị vào form **bất kỳ lúc nào sau khi mount**. Kết hợp với `useEffect` (chạy mỗi khi `profile` thay đổi), ta có thể đổ dữ liệu vào form ngay khi API trả về.

Sơ đồ thời gian:

```
Component mount
    ↓
defaultValues = { name: '', phone: '', ... }  → Form hiển thị rỗng
    ↓
API gọi xong → profileData có giá trị → profile = { name: 'Nguyen Van A', ... }
    ↓
useEffect phát hiện profile thay đổi → chạy callback
    ↓
setValue('name', 'Nguyen Van A')
setValue('phone', '0987...')
...
    ↓
Form hiển thị dữ liệu thật
```

### Tại sao đổi `date_of_birth` sang `Date` object?

```typescript
profile.date_of_birth ? new Date(profile.date_of_birth) : new Date(1990, 0, 1)
```

API trả `date_of_birth` dưới dạng chuỗi: `"1999-10-22T00:00:00.000Z"`. Component `DateSelect` cần `Date` object để có thể gọi `.getDate()`, `.getMonth()`, `.getFullYear()`. Nên phải convert ngay khi đổ vào form.

Nếu `date_of_birth` là `undefined` (user chưa nhập), dùng giá trị mặc định `new Date(1990, 0, 1)` (1/1/1990).

---

## 4. Kết Nối Các Ô Input Với Form

### Input thường — dùng `register`

`register` là cách đơn giản nhất để nối input HTML vào form:

```tsx
<Input
  register={register}
  name='name'
  placeholder='Tên'
  errorMessage={errors.name?.message}
/>
```

`register('name')` trả về một số props (`name`, `onChange`, `onBlur`, `ref`) và gán chúng vào input. React Hook Form dùng những props này để theo dõi giá trị và trạng thái của input.

Component `Input` tự xử lý việc lan truyền `register` props — nên ở đây chỉ cần truyền `register` và `name`.

### Input custom — dùng `Controller`

Một số component không phải HTML input thông thường (như `InputNumber`, `DateSelect`) không nhận `register`. Phải dùng `Controller` để "bọc" chúng:

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

`Controller` hoạt động như người trung gian:
- Nhận `control` từ `useForm` để kết nối với form
- Render component con thông qua prop `render`
- Cung cấp `field` object chứa `value`, `onChange`, `onBlur`, `ref` cho component con

**Tóm tắt khi nào dùng gì:**

```
Input HTML thông thường (<input>, <select>, <textarea>)
    → Dùng register()

Component custom (InputNumber, DateSelect, ...)
    → Dùng Controller
```

---

## 5. Component `DateSelect` — Chọn Ngày Sinh

### Tại sao cần component riêng?

HTML không có input chuẩn cho chọn ngày/tháng/năm riêng biệt. Yêu cầu UI là 3 dropdown (ngày, tháng, năm) riêng rẽ → cần tự xây component.

### Props của `DateSelect`:

```typescript
interface Props {
  onChange: (value: Date) => void  // Callback báo ngược Date mới lên form
  value?: Date                     // Giá trị hiện tại từ form
  errorMessage?: string            // Thông báo lỗi validate
}
```

### State nội bộ:

```typescript
const [date, setDate] = useState({
  date: value?.getDate() || 1,           // Ngày (1-31)
  month: value?.getMonth() || 0,         // Tháng (0-11, JavaScript đếm từ 0)
  year: value?.getFullYear() || 1990     // Năm
})
```

Component lưu 3 giá trị riêng rẽ vì mỗi dropdown chỉ thay đổi một phần. Khi user đổi một trong ba, component ghép lại thành `Date` object rồi gọi `onChange`.

### Hàm `handleChange` — Computed Property Name:

```typescript
const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
  const { value: valueFromSelect, name } = event.target
  const newDate = {
    ...date,          // Giữ lại 2 field không đổi
    [name]: Number(valueFromSelect)  // Ghi đè field đang thay đổi
  }
  setDate(newDate)
  onChange(new Date(newDate.year, newDate.month, newDate.date))
}
```

**`[name]`** là **Computed Property Name** — dùng giá trị của biến `name` làm key trong object. Khi user đổi dropdown "Tháng":

```
name = 'month'   (từ attribute name của <select name='month'>)
valueFromSelect = '7'  (giá trị user chọn)

newDate = {
  date: 15,         ← giữ nguyên
  [name]: 7,        ← tương đương: month: 7
  year: 2001        ← giữ nguyên
}
→ new Date(2001, 7, 15) = 15/08/2001
```

Không cần `if/else` cho từng trường hợp — Computed Property Name giúp code gọn và tổng quát.

### Dùng `DateSelect` trong `Profile.tsx`:

```tsx
<Controller
  control={control}
  name='date_of_birth'
  render={({ field }) => (
    <DateSelect
      errorMessage={errors.date_of_birth?.message}
      value={field.value}     // form → DateSelect
      onChange={field.onChange} // DateSelect → form (cập nhật khi user thay đổi)
    />
  )}
/>
```

Luồng dữ liệu hai chiều:
- Form truyền `value` xuống `DateSelect` → 3 dropdown hiển thị đúng ngày/tháng/năm
- `DateSelect` gọi `onChange` lên form → form lưu Date object mới

---

## 6. `src/utils/rules.ts` — Thêm `userSchema`

```typescript
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

export type UserSchema = yup.InferType<typeof userSchema>
```

`userSchema` là **schema lớn** cho toàn bộ dữ liệu user. Mỗi form (Profile, ChangePassword) sẽ lấy ra tập hợp con phù hợp bằng `.pick()`.

**`yup.InferType<typeof userSchema>`** — TypeScript tự suy ra type từ Yup schema. Thay vì khai báo thủ công:

```typescript
// Không cần làm thế này:
interface UserSchema {
  name?: string
  phone?: string
  // ...
}

// TypeScript tự suy ra từ Yup schema:
export type UserSchema = yup.InferType<typeof userSchema>
// → { name?: string, phone?: string, date_of_birth?: Date, ... }
```

---

## Luồng Hoạt Động Sau Commit

```
1. User mở /user/profile
2. useQuery gọi userApi.getProfile()
3. API trả về dữ liệu user
4. useEffect phát hiện profile thay đổi → setValue() đổ data vào form
5. Input, InputNumber, DateSelect hiển thị dữ liệu thật
6. User thay đổi dữ liệu, bấm [Lưu]
7. (Hiện tại chỉ console.log — chưa gọi API update)
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **`useQuery`** | Hook của TanStack Query để gọi API đọc dữ liệu. Tự động chạy khi component mount, quản lý trạng thái loading/success/error, và cache kết quả. |
| **`setValue`** | Hàm của React Hook Form để gán giá trị vào form sau khi component đã mount. Dùng khi data đến từ API hoặc nguồn bên ngoài form. |
| **`defaultValues` vs `setValue`** | `defaultValues` chỉ chạy khi khởi tạo form. `setValue` có thể gán giá trị bất kỳ lúc nào — thường trong `useEffect` khi API trả về dữ liệu. |
| **`register` vs `Controller`** | `register` dùng cho HTML input thông thường. `Controller` dùng cho component custom không nhận `register` props trực tiếp. |
| **`yupResolver`** | Adapter kết nối Yup validation schema với React Hook Form. Khi submit, RHF chạy Yup schema, nếu fail thì bổ sung lỗi vào `formState.errors`. |
| **`schema.pick([])`** | Tạo schema Yup mới chỉ chứa các field được chỉ định. Tránh tạo lại validation rules từ đầu. |
| **Computed Property Name `[name]`** | Dùng giá trị của biến `name` làm key trong object literal: `{ [name]: value }`. Giúp code tổng quát, tránh lặp nhiều `if/else`. |
