# 74287b2 — feat: Code logic đổi mật khẩu

## Tổng Quan

Commit này hoàn thiện chức năng **Đổi mật khẩu** cho trang User Profile. Có 3 file thay đổi chính:

| File | Thay đổi |
|------|----------|
| `src/utils/rules.ts` | Thêm `userSchema` với validation cho `password`, `new_password`, `confirm_password` |
| `src/components/Input/Input.tsx` | Thêm tính năng **show/hide password** (icon con mắt) |
| `src/pages/User/pages/ChangePassword/ChangePassword.tsx` | Viết hoàn toàn logic form đổi mật khẩu |

---

## Nội Dung Chức Năng

Trang đổi mật khẩu có 3 field:
- **Mật khẩu cũ** (`password`) — để xác nhận danh tính user
- **Mật khẩu mới** (`new_password`)
- **Nhập lại mật khẩu** (`confirm_password`) — phải khớp với `new_password`

Khi submit:
1. Validate bằng Yup schema (client-side)
2. Gọi API `userApi.updateProfile` với `{ password, new_password }` — bỏ `confirm_password` vì server không cần
3. Thành công → hiện toast thành công
4. API trả lỗi 422 (Unprocessable Entity) → hiển thị lỗi ngay dưới từng input

---

## 1. `rules.ts` — Thêm `userSchema`

### Hàm helper `handleConfirmPasswordYup`

```typescript
const handleConfirmPasswordYup = (refString: string) => {
  return yup
    .string()
    .required('Nhập lại password là bắt buộc')
    .min(6, 'Độ dài từ 6 - 160 ký tự')
    .max(160, 'Độ dài từ 6 - 160 ký tự')
    .oneOf([yup.ref(refString)], 'Nhập lại password không khớp')
    //      ↑ yup.ref('new_password') = "lấy giá trị của field new_password trong cùng schema"
}
```

**`yup.ref(fieldName)`** — Đây là cách Yup tham chiếu đến giá trị của một field khác trong cùng object đang validate. Ví dụ:

```typescript
handleConfirmPasswordYup('new_password')
// → confirm_password phải === new_password
// Nếu new_password = 'abc123' thì confirm_password cũng phải là 'abc123'
```

Hàm nhận `refString` thay vì hardcode `'new_password'` để có thể tái sử dụng với tên field khác nếu cần.

### `userSchema` — Schema dùng chung cho toàn bộ tính năng User

```typescript
export const userSchema = yup.object({
  name: yup.string().max(160, 'Độ dài tối đa là 160 ký tự'),
  phone: yup.string().max(20, 'Độ dài tối đa là 20 ký tự'),
  address: yup.string().max(160, 'Độ dài tối đa là 160 ký tự'),
  avatar: yup.string().max(1000, 'Độ dài tối đa là 1000 ký tự'),
  date_of_birth: yup.date().max(new Date(), 'Hãy chọn một ngày trong quá khứ'),

  // Tái sử dụng passwordRule — biến định nghĩa một lần, dùng cho cả 2 schema
  password: passwordRule,       // min 6, max 160, required
  new_password: passwordRule,   // giống password
  confirm_password: handleConfirmPasswordYup('new_password')  // phải khớp new_password
})

export type UserSchema = yup.InferType<typeof userSchema>
```

### Tại sao dùng biến `passwordRule` thay vì `schema.fields['password']`?

```typescript
// Cách sai — trả về kiểu Schema<unknown>, mất type information
password: schema.fields['password'],

// Cách đúng — giữ nguyên kiểu StringSchema, TypeScript biết chính xác type
const passwordRule = yup.string().required(...).min(6, ...).max(160, ...)

export const schema = yup.object({ password: passwordRule, ... })
export const userSchema = yup.object({ password: passwordRule, new_password: passwordRule, ... })
```

TypeScript cần biết chính xác kiểu của từng field trong schema để `userSchema.pick([...])` có thể infer đúng kiểu cho `yupResolver`. Dùng `schema.fields['password']` trả về `Schema<unknown>` → mất thông tin kiểu → `yupResolver` không hoạt động đúng.

---

## 2. `Input.tsx` — Thêm Toggle Show/Hide Password

```typescript
const [openEye, setOpenEye] = useState(false)   // false = đang ẩn password (mắt nhắm)

const handleType = () => {
  if (rest.type === 'password') {
    return openEye ? 'text' : 'password'   // Mở mắt → hiện text; Nhắm mắt → ẩn thành ****
  }
  return rest.type    // Không phải password field → giữ nguyên type gốc
}
```

**Logic hiển thị icon:**

```tsx
{/* CHỈ hiện icon khi type='password' */}
{rest.type === 'password' && openEye && <SvgEyeOpen onClick={toggleEye} />}
{rest.type === 'password' && !openEye && <SvgEyeClosed onClick={toggleEye} />}
```

**Tại sao đọc từ `rest.type` chứ không phải state?**

Component `Input` dùng `...rest` để nhận tất cả HTML input props còn lại, bao gồm `type`. Bên trong, ta cần **đọc `type` gốc** mà người dùng truyền vào (để biết có phải password field không), nhưng **trả về type khác** khi render input thực tế (để toggle show/hide):

```typescript
export default function Input({ ..., ...rest }: Props) {
  // rest.type = type gốc do parent truyền vào ('password', 'text', 'email'...)
  // handleType() = type thực tế sẽ dùng (có thể bị override khi toggle)

  return (
    <input
      {...rest}
      type={handleType()}   // Override type của rest
    />
  )
}
```

Nếu đọc từ state thay vì `rest.type`, ta không biết field này có phải password field không — vì `openEye` chỉ có giá trị khi đã chuyền `type='password'`.

---

## 3. `ChangePassword.tsx` — Logic Form Đổi Mật Khẩu

### Khai báo FormData Type và Schema

```typescript
// Chỉ lấy 3 field cần thiết từ UserSchema
type FormData = Pick<UserSchema, 'password' | 'new_password' | 'confirm_password'>

// Tạo schema con chỉ validate 3 field đó
const passwordSchema = userSchema.pick(['password', 'new_password', 'confirm_password'])
```

`userSchema` có 8 field, nhưng form đổi mật khẩu chỉ có 3 field. Dùng `.pick()` để:
1. Tránh validate những field không có trong form → không gây lỗi validation giả
2. Tái sử dụng validation rules đã định nghĩa sẵn trong `userSchema`

### Setup `useForm`

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
  resolver: yupResolver(passwordSchema)   // Kết nối Yup schema với React Hook Form
})
```

`yupResolver` là adapter kết nối Yup với React Hook Form — khi submit, RHF tự động chạy Yup schema để validate, nếu có lỗi thì tự động đổ vào `formState.errors` mà không cần viết logic validate riêng.

### Gọi API

```typescript
const updateProfileMutation = useMutation({
  mutationFn: userApi.updateProfile
})
```

**`useMutation`** (TanStack Query) dùng cho các request **thay đổi dữ liệu** (POST/PUT/PATCH/DELETE):

```typescript
// Khác với useQuery (tự động chạy khi mount), useMutation:
// - Chỉ chạy khi gọi thủ công: mutation.mutate() hoặc mutation.mutateAsync()
// - Theo dõi trạng thái: isPending, isSuccess, isError
// - Thường dùng trong event handler (onClick, onSubmit)
```

### Xử Lý Submit

```typescript
const onSubmit = handleSubmit(async (data) => {
  try {
    // omit bỏ field confirm_password — API không cần, chỉ để validate ở client
    const res = await updateProfileMutation.mutateAsync(omit(data, ['confirm_password']))
    toast.success(res.data.message)
  } catch (error) {
    // Xử lý lỗi 422 từ server (password cũ sai, password mới không đủ mạnh...)
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

**`omit(data, ['confirm_password'])`** — Lodash utility bỏ key khỏi object:

```typescript
// data = { password: '123456', new_password: '654321', confirm_password: '654321' }
omit(data, ['confirm_password'])
// → { password: '123456', new_password: '654321' }
// Server không cần confirm_password — chỉ dùng để validate client-side
```

**Xử lý lỗi 422:** Server có thể trả lỗi từ backend validation (ví dụ: password cũ không đúng). Lỗi trả về dạng object `{ fieldName: 'thông báo lỗi' }`. Code duyệt qua từng key và gắn lỗi lên đúng form field bằng `setError()`:

```typescript
// Server trả: { data: { password: 'Mật khẩu cũ không đúng' } }
setError('password', {
  message: 'Mật khẩu cũ không đúng',  // Lỗi từ server
  type: 'Server'                        // Phân biệt với lỗi client-side ('manual')
})
// → Lỗi hiện ngay dưới input password
```

---

## Luồng Chạy Của Trang Đổi Mật Khẩu

```
User nhập form: password cũ, password mới, nhập lại password mới
       ↓
[Nút Lưu] → handleSubmit()
       ↓
React Hook Form validate (Yup schema):
       ├── Lỗi client-side (confirm_password không khớp, password quá ngắn...)
       │       → Hiển thị lỗi dưới input, dừng lại
       └── Tất cả hợp lệ → chạy onSubmit()
                    ↓
              omit(['confirm_password']) → gọi updateProfileMutation.mutateAsync()
                    ├── Thành công → toast.success()
                    └── Lỗi 422   → setError() từng field → hiển thị lỗi server dưới input
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **`yup.ref(fieldName)`** | Tham chiếu đến giá trị của field khác trong cùng schema. Dùng để so sánh hai field với nhau, ví dụ `confirm_password` phải khớp `new_password`. |
| **`schema.pick([...])`** | Tạo schema con chỉ chứa các field được chỉ định. Tái sử dụng validation rules mà không phải viết lại. |
| **`yup.InferType<typeof schema>`** | TypeScript tự suy ra type từ Yup schema — không cần khai báo interface thủ công, tránh bất đồng bộ giữa schema và type. |
| **`useMutation`** | TanStack Query hook cho request thay đổi dữ liệu. Chạy thủ công (không tự động), theo dõi trạng thái loading/error/success. |
| **`omit(obj, [keys])`** | Lodash utility — tạo object mới loại bỏ các key chỉ định. Dùng khi cần bỏ field client-only (confirm_password) trước khi gửi lên server. |
| **`setError(field, { message })`** | React Hook Form — đặt lỗi thủ công cho một field. Thường dùng khi muốn hiển thị lỗi từ server response ngay dưới input tương ứng. |
| **`type: 'Server'`** | Label tùy chỉnh phân biệt nguồn gốc lỗi: `'Server'` = lỗi từ backend, `'manual'` = lỗi đặt thủ công trong code. Giúp debug và có thể dùng để phân biệt cách hiển thị. |
| **Toggle show/hide password** | Dùng state `openEye` kết hợp với `rest.type` để chuyển đổi `type='password'` ↔ `type='text'`. Đọc từ `rest.type` (type gốc) chứ không phải từ state để biết đây có phải password field không. |
