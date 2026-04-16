# 74287b2 — feat: Code logic đổi mật khẩu

## 🎯 Tổng Quan

Commit này hoàn thiện chức năng **Đổi mật khẩu** cho trang User Profile. Có 3 file thay đổi chính:

| File | Thay đổi |
|------|----------|
| `src/utils/rules.ts` | Thêm `userSchema` với validation cho `password`, `new_password`, `confirm_password` |
| `src/components/Input/Input.tsx` | Thêm tính năng **show/hide password** (icon con mắt) |
| `src/pages/User/pages/ChangePassword/ChangePassword.tsx` | Viết hoàn toàn logic form đổi mật khẩu |

---

## 📋 Nội Dung Chức Năng

Trang đổi mật khẩu có 3 field:
- **Mật khẩu cũ** (`password`)
- **Mật khẩu mới** (`new_password`)
- **Nhập lại mật khẩu** (`confirm_password`)

Khi submit:
1. Validate bằng Yup schema
2. Gọi API `userApi.updateProfile` với `{ password, new_password }` (bỏ `confirm_password`)
3. Nếu thành công → toast thành công
4. Nếu API trả lỗi 422 (Unprocessable Entity) → hiển thị lỗi ngay dưới từng input

---

## 📁 Thay Đổi Chi Tiết

### 1. `rules.ts` — Thêm `userSchema`

#### Hàm helper `handleConfirmPasswordYup`

```typescript
const handleConfirmPasswordYup = (refString: string) => {
  return yup
    .string()
    .required('Nhập lại password là bắt buộc')
    .min(6, 'Độ dài từ 6 - 160 ký tự')
    .max(160, 'Độ dài từ 6 - 160 ký tự')
    .oneOf([yup.ref(refString)], 'Nhập lại password không khớp')
    //      ↑ yup.ref('new_password') → so sánh với field new_password trong cùng schema
}
```

**`yup.ref(refString)`** — Đây là cách Yup tham chiếu đến giá trị của một field khác trong cùng object. Ví dụ:

```typescript
handleConfirmPasswordYup('new_password')
// → confirm_password phải === new_password
```

#### `userSchema` — Schema dùng cho trang Profile + Đổi mật khẩu

```typescript
export const userSchema = yup.object({
  name: yup.string().max(160, 'Độ dài tối đa là 160 ký tự'),
  phone: yup.string().max(20, 'Độ dài tối đa là 20 ký tự'),
  address: yup.string().max(160, 'Độ dài tối đa là 160 ký tự'),
  avatar: yup.string().max(1000, 'Độ dài tối đa là 1000 ký tự'),
  date_of_birth: yup.date().max(new Date(), 'Hãy chọn một ngày trong quá khứ'),

  // Tái sử dụng passwordRule — biến dùng chung với schema login/register
  password: passwordRule,       // min 6, max 160, required
  new_password: passwordRule,   // giống password
  confirm_password: handleConfirmPasswordYup('new_password')  // phải khớp new_password
})

export type UserSchema = yup.InferType<typeof userSchema>
// → TypeScript tự suy ra type từ schema — không cần viết thủ công
```

**Tại sao dùng biến `passwordRule` thay vì `schema.fields['password']`?**

```typescript
// ❌ Không nên — .fields[] trả về kiểu Schema<unknown>, mất type information
password: schema.fields['password'],
new_password: schema.fields['password'],

// ✅ Nên — biến giữ nguyên kiểu StringSchema<string>, dùng lại ở cả hai schema
const passwordRule = yup.string().required(...).min(6, ...).max(160, ...)

export const schema = yup.object({ password: passwordRule, ... })
export const userSchema = yup.object({ password: passwordRule, new_password: passwordRule, ... })
```

Nhờ đó `userSchema.pick(['password', 'new_password', 'confirm_password'])` infer đúng kiểu `string`, `yupResolver` hoạt động bình thường.

---

### 2. `Input.tsx` — Thêm Toggle Show/Hide Password

Trước commit này, component `Input` không có icon mắt. Bây giờ đã thêm:

```typescript
const [openEye, setOpenEye] = useState(false)   // false = đang ẩn password

const handleType = () => {
  if (rest.type === 'password') {
    return openEye ? 'text' : 'password'   // Mở mắt → hiện text, Nhắm mắt → ẩn lại
  }
  return rest.type                          // Không phải password field → giữ nguyên type
}
```

**Logic hiển thị icon:**

```tsx
{/* CHỈ hiện icon khi type='password' */}
{rest.type === 'password' && openEye && <SvgEyeOpen onClick={toggleEye} />}
{rest.type === 'password' && !openEye && <SvgEyeClosed onClick={toggleEye} />}
```

**Tại sao dùng `rest.type` chứ không phải `type` trực tiếp?**

```typescript
// Props component nhận vào:
export default function Input({ ..., ...rest }: Props) {
  // rest = tất cả các HTML input props còn lại, bao gồm type, placeholder, ...
  
  // Không thể dùng `type` vì ta override nó bằng handleType()
  // Nên phải đọc type gốc từ rest để biết có phải password field không
  const handleType = () => {
    if (rest.type === 'password') { ... }   // ← Đọc type gốc do người dùng truyền vào
  }
}
```

---

### 3. `ChangePassword.tsx` — Logic Form Đổi Mật Khẩu

#### Khai báo FormData Type và Schema

```typescript
// Chọn ra 3 field từ UserSchema để dùng cho form này
type FormData = Pick<UserSchema, 'password' | 'new_password' | 'confirm_password'>

// Tạo schema con chỉ chứa 3 field đó
const passwordSchema = userSchema.pick(['password', 'new_password', 'confirm_password'])
```

**Vì sao dùng `.pick()`?**

`userSchema` có tổng cộng 7 field (name, phone, address, avatar, date_of_birth, password, new_password, confirm_password). Trang đổi mật khẩu chỉ cần 3 field → dùng `.pick()` để cắt bớt:

```typescript
// userSchema.pick([...]) → tạo schema mới chỉ có các field được chỉ định
const passwordSchema = userSchema.pick(['password', 'new_password', 'confirm_password'])
// → { password: ..., new_password: ..., confirm_password: ... }
```

---

#### Setup `useForm`

```typescript
const {
  register,
  formState: { errors },
  handleSubmit,
  setError
} = useForm<FormData>({
  defaultValues: {
    password: '',
    new_password: '',
    confirm_password: ''
  },
  resolver: yupResolver(passwordSchema)   // ← Kết nối Yup schema với React Hook Form
})
```

**`yupResolver`** — Là cầu nối giữa Yup và React Hook Form:
- Khi submit, React Hook Form chạy Yup schema để validate
- Nếu có lỗi → tự động đổ vào `formState.errors`
- Không cần validate thủ công từng field

---

#### Gọi API

```typescript
const updateProfileMutation = useMutation({
  mutationFn: userApi.updateProfile
})
```

**`useMutation`** (React Query) — Dùng cho các request **thay đổi dữ liệu** (POST/PUT/PATCH/DELETE):

```typescript
// Khác với useQuery (đọc data), useMutation cho phép:
// - Gọi thủ công lúc cần (không tự động chạy)
// - Theo dõi trạng thái: isPending, isSuccess, isError
// - Dùng mutateAsync() để await kết quả
```

---

#### Xử lý Submit

```typescript
const onSubmit = handleSubmit(async (data) => {
  try {
    // omit bỏ field confirm_password — API không cần field này
    const res = await updateProfileMutation.mutateAsync(omit(data, ['confirm_password']))
    toast.success(res.data.message)
  } catch (error) {
    // Xử lý lỗi 422 từ server (validation fail phía backend)
    if (isAxiosUnprocessableEntityError<ErrorResponse<FormData>>(error)) {
      const formError = error.response?.data.data
      if (formError) {
        Object.keys(formError).forEach((key) => {
          setError(key as keyof FormData, {
            message: formError[key as keyof FormData],
            type: 'Server'
          })
        })
      }
    }
  }
})
```

**Chi tiết từng phần:**

```typescript
// 1. omit() — từ lodash — bỏ field không cần
omit(data, ['confirm_password'])
// { password: '123456', new_password: '654321', confirm_password: '654321' }
// → { password: '123456', new_password: '654321' }

// 2. isAxiosUnprocessableEntityError — hàm tự viết để check lỗi 422
// Lỗi 422 = server nhận được request nhưng validation fail (ví dụ: password cũ sai)

// 3. setError() — đặt lỗi cho một field cụ thể trong form
setError('password', {
  message: 'Mật khẩu cũ không đúng',  // Lỗi từ server
  type: 'Server'
})
// → Lỗi sẽ hiển thị ngay dưới input password
```

---

## 🔄 Luồng Chạy Của Trang Đổi Mật Khẩu

```
User nhập form
       ↓
[Nút Lưu] → handleSubmit()
       ↓
React Hook Form validate (Yup schema)
       ├── Lỗi client → hiển thị lỗi dưới input, dừng lại
       └── OK → chạy onSubmit()
                    ↓
              gọi updateProfileMutation.mutateAsync()
                    ├── Thành công → toast.success()
                    └── Lỗi 422   → setError() từng field → hiển thị lỗi server dưới input
```

---

## 📌 Kiến Thức Mới Trong Commit Này

| Khái niệm | Giải thích |
|-----------|-----------|
| **`yup.ref(fieldName)`** | Tham chiếu đến giá trị field khác trong cùng schema — dùng để so sánh hai field với nhau |
| **`schema.pick([...])`** | Tạo schema con chỉ chứa các field được chọn — tránh lặp code validation |
| **`yup.InferType<typeof schema>`** | TypeScript tự suy ra type từ Yup schema — không cần khai báo type thủ công |
| **`useMutation`** | React Query hook cho request thay đổi dữ liệu — gọi thủ công, theo dõi loading/error |
| **`omit(obj, [keys])`** | Lodash function — tạo object mới loại bỏ các key được chỉ định |
| **`setError(field, { message })`** | React Hook Form — đặt lỗi thủ công cho một field (thường dùng cho lỗi từ server) |
| **`type: 'Server'`** | Label phân biệt lỗi gốc — `'Server'` = lỗi từ backend, `'manual'` = lỗi đặt thủ công |
| **Toggle show/hide password** | Dùng `useState` + SVG icon để chuyển đổi `type='password'` ↔ `type='text'` |
