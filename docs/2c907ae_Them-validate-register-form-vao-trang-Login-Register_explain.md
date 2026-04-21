# 2c907ae — feat: Thêm validate register form vào trang Login, Register

## Tổng Quan

Commit này là bước đầu tiên tích hợp **React Hook Form** vào dự án. Trước đây, form Đăng ký và Đăng nhập chỉ là HTML tĩnh — bấm nút Submit không có gì xảy ra, không validate, không lấy được dữ liệu.

Sau commit này:
1. Cài thêm thư viện `react-hook-form`.
2. Tạo file `rules.ts` — định nghĩa tập trung các rule validate cho 3 field: email, password, confirm_password.
3. Kết nối form Register với React Hook Form — bắt sự kiện submit, validate field, hiển thị lỗi.
4. Kết nối form Login với React Hook Form — bắt sự kiện submit (validate chưa dùng rules, chỉ khởi tạo hook).

Lưu ý: commit này chỉ `console.log(data)` khi submit — chưa gọi API. Phần gọi API đăng nhập/đăng ký sẽ được làm ở commit sau.

---

## Các File Thay Đổi

| File | Loại thay đổi | Vai trò |
|------|---------------|---------|
| `package.json` | Sửa | Thêm dependency `react-hook-form` |
| `src/utils/rules.ts` | Tạo mới | Tập trung các rule validate cho form |
| `src/pages/Register/Register.tsx` | Sửa lớn | Kết nối form với React Hook Form, hiển thị lỗi |
| `src/pages/Login/Login.tsx` | Sửa nhỏ | Khởi tạo hook, thêm `type="submit"` |

---

## 1. `package.json` — Cài Thêm `react-hook-form`

```diff
+ "react-hook-form": "^7.71.1"
```

**React Hook Form** là thư viện quản lý form phổ biến nhất trong hệ sinh thái React. So với cách quản lý form thủ công bằng `useState`:

| Tiêu chí | `useState` thủ công | React Hook Form |
|----------|--------------------|--------------------|
| Số lượng state | 1 state / field | Không cần state |
| Re-render | Mỗi khi gõ phím | Tối thiểu |
| Validate | Tự viết if/else | Khai báo rules, tự chạy |
| Lấy giá trị | `value` state | `handleSubmit(data => ...)` |
| Error message | Tự quản lý | Tự động qua `formState.errors` |

Với form có 3 field, cách thủ công cần ~3 `useState` + nhiều `onChange` handler + validate tự viết. React Hook Form rút gọn tất cả xuống còn `useForm()` + `register()` + `handleSubmit()`.

---

## 2. `src/utils/rules.ts` — File Tập Trung Validate Rules

```typescript
export const rules = {
  email: {
    required: {
      value: true,
      message: 'Email là bắt buộc'
    },
    pattern: {
      value: /^\S+@\S+\.\S+$/,
      message: 'Email không đúng định dạng'
    },
    maxLength: {
      value: 160,
      message: 'Độ dài từ 5 - 160 ký tự'
    },
    minLength: {
      value: 5,
      message: 'Độ dài từ 5 - 160 ký tự'
    }
  },
  password: {
    required: {
      value: true,
      message: 'Password là bắt buộc'
    },
    maxLength: {
      value: 160,
      message: 'Độ dài từ 6 - 160 ký tự'
    },
    minLength: {
      value: 6,
      message: 'Độ dài từ 6 - 160 ký tự'
    }
  },
  confirm_password: {
    required: {
      value: true,
      message: 'Nhập lại password là bắt buộc'
    },
    maxLength: {
      value: 160,
      message: 'Độ dài từ 6 - 160 ký tự'
    },
    minLength: {
      value: 6,
      message: 'Độ dài từ 6 - 160 ký tự'
    }
  }
}
```

### Tại sao không viết rules thẳng vào component?

**Cách sai — inline rules trong component:**

```tsx
// Register.tsx
<input
  {...register('email', {
    required: { value: true, message: 'Email là bắt buộc' },
    pattern: { value: /^\S+@\S+\.\S+$/, message: 'Email không đúng định dạng' },
    minLength: { value: 5, message: 'Độ dài từ 5 - 160 ký tự' },
    maxLength: { value: 160, message: 'Độ dài từ 5 - 160 ký tự' }
  })}
/>
```

Vấn đề: Khi có form khác cũng cần validate email (ví dụ form quên mật khẩu), phải copy-paste nguyên đoạn rules đó. Khi cần sửa validation (đổi minLength từ 5 thành 3), phải tìm và sửa ở tất cả mọi nơi.

**Cách đúng — tập trung vào `rules.ts`:**

```tsx
// Register.tsx (gọn hơn nhiều)
<input {...register('email', rules.email)} />
// Login.tsx (dùng chung)
<input {...register('email', rules.email)} />
```

Khi cần sửa rule email, chỉ sửa `rules.ts` ở một chỗ duy nhất — tất cả form dùng đều được cập nhật.

### Giải thích Regex `^\S+@\S+\.\S+$`:

```
^        → Bắt đầu chuỗi
\S+      → Một hoặc nhiều ký tự không phải khoảng trắng (phần local của email)
@        → Ký tự @ literal
\S+      → Một hoặc nhiều ký tự không phải khoảng trắng (tên domain)
\.       → Dấu chấm literal (phải escape vì . trong regex = "bất kỳ ký tự")
\S+      → Một hoặc nhiều ký tự không phải khoảng trắng (extension: .com, .vn...)
$        → Kết thúc chuỗi
```

| Email | Kết quả | Lý do |
|-------|---------|-------|
| `user@gmail.com` | Hợp lệ | Đúng format |
| `user @gmail.com` | Không hợp lệ | Có khoảng trắng (`\S+` không cho phép) |
| `usergmail.com` | Không hợp lệ | Thiếu `@` |
| `user@gmailcom` | Không hợp lệ | Thiếu dấu `.` |

Đây là regex validate email đơn giản, không hoàn toàn chính xác theo RFC 5321, nhưng đủ dùng cho hầu hết trường hợp thực tế.

### Format rule của React Hook Form:

```typescript
{
  required: {
    value: true,             // Bật rule này
    message: 'Thông báo lỗi khi vi phạm rule'  // Hiển thị khi validate fail
  },
  minLength: {
    value: 5,               // Giá trị của rule (số ký tự tối thiểu)
    message: '...'
  }
}
```

Mỗi rule có dạng `{ value, message }`. Khi user submit, React Hook Form kiểm tra từng rule theo thứ tự — nếu vi phạm, dừng lại và gán `message` vào `errors.fieldName.message`.

---

## 3. `Register.tsx` — Kết Nối Form Với React Hook Form

### Khai báo `FormData` interface:

```typescript
interface FormData {
  email: string
  password: string
  confirm_password: string
}
```

Interface này mô tả **shape (hình dạng)** của dữ liệu form — các field có trong form và kiểu dữ liệu tương ứng. Truyền vào generic `useForm<FormData>()` để TypeScript biết form có những field nào, giúp autocomplete và phát hiện lỗi tên field khi viết code.

### Khởi tạo hook:

```typescript
const {
  register,
  handleSubmit,
  formState: { errors }
} = useForm<FormData>()
```

| Biến | Kiểu | Dùng để |
|------|------|---------|
| `register` | Function | Gắn input HTML vào form — theo dõi giá trị + trigger validate |
| `handleSubmit` | Function | Bọc hàm xử lý submit — tự validate trước khi gọi callback |
| `errors` | Object | Chứa thông báo lỗi của từng field sau khi validate |

### Hàm xử lý submit:

```typescript
const onSubmit = handleSubmit((data) => {
  console.log(data)
  // data = { email: '...', password: '...', confirm_password: '...' }
})
```

**`handleSubmit(callback)`** là Higher-Order Function — nhận một callback và trả về một function mới. Function mới này khi gọi sẽ:
1. Chạy validate tất cả field dùng rules đã đăng ký
2. Nếu có lỗi → cập nhật `formState.errors`, **không gọi** callback
3. Nếu tất cả hợp lệ → gọi callback với `data` là object chứa giá trị các field

```
User bấm Đăng ký
    ↓
onSubmit() chạy = handleSubmit(callback)()
    ↓
React Hook Form validate tất cả fields:
    ├── email bỏ trống?  → errors.email.message = 'Email là bắt buộc'
    ├── password <6 ký tự? → errors.password.message = '...'
    └── confirm_password bỏ trống? → errors.confirm_password.message = '...'
    ↓
Có lỗi? → Dừng lại, re-render, hiển thị lỗi dưới các input
Không lỗi? → Gọi callback(data) → console.log(data)
```

### Gắn form vào JSX:

```tsx
<form onSubmit={onSubmit}>
```

`onSubmit` (kết quả của `handleSubmit(...)`) được gắn vào event `onSubmit` của thẻ `<form>`. React Hook Form sẽ tự xử lý `event.preventDefault()` bên trong để ngăn form reload trang.

### Gắn input vào form bằng `register`:

```tsx
{/* TRƯỚC — input HTML thông thường, không được quản lý */}
<input type='email' name='email' ... />

{/* SAU — gắn vào React Hook Form bằng spread operator */}
<input type='email' {...register('email', rules.email)} ... />
```

`register('email', rules.email)` trả về một object chứa các props cần thiết:

```typescript
{
  name: 'email',       // Tên field
  ref: ...,            // Ref để RHF truy cập DOM element
  onChange: ...,       // Theo dõi khi user gõ
  onBlur: ...          // Theo dõi khi input mất focus
}
```

`{...register(...)}` là spread operator — trải toàn bộ các props đó vào thẻ `<input>`. Tương đương viết thủ công:

```tsx
<input
  name='email'
  ref={emailRef}
  onChange={handleEmailChange}
  onBlur={handleEmailBlur}
/>
```

Nhưng ngắn gọn hơn nhiều.

### Hiển thị lỗi validate:

```tsx
{/* Trước — div rỗng, không hiển thị gì */}
<div className='mt-1 text-red-600 min-h-4 text-sm'></div>

{/* Sau — hiển thị thông báo lỗi nếu có */}
<div className='mt-1 text-red-600 min-h-4 text-sm'>
  {errors.email?.message}
</div>
```

`errors` là object, mỗi key là tên field lỗi:

```typescript
// Khi email để trống và submit:
errors = {
  email: {
    type: 'required',
    message: 'Email là bắt buộc'  ← errors.email.message
  }
}

// Khi tất cả hợp lệ:
errors = {}  → errors.email = undefined → errors.email?.message = undefined → render không hiện gì
```

**`?.` (Optional Chaining):** Chỉ đọc `.message` nếu `errors.email` tồn tại — tránh lỗi `Cannot read property 'message' of undefined` khi field chưa có lỗi.

**`min-h-[1.25rem]`** — Chiều cao tối thiểu của div lỗi. Khi không có lỗi, div vẫn chiếm không gian này → layout không bị "nhảy" (layout shift) khi lỗi xuất hiện hoặc biến mất.

---

## 4. `Login.tsx` — Khởi Tạo Hook Cơ Bản

```typescript
const {
  register,
  handleSubmit,
  formState: { errors }
} = useForm()       // Không truyền generic type (chưa khai báo interface)

const onSubmit = handleSubmit((data) => {
  console.log(data)
})
```

Khác với Register, Login chỉ khởi tạo hook mà chưa:
- Khai báo `FormData` interface
- Gắn `rules` vào các input (chỉ thêm `type='submit'` cho button)
- Hiển thị `errors.xxx.message` dưới input

Đây là commit đang làm nhanh để form hoạt động cơ bản — validation đầy đủ cho Login sẽ được thêm sau.

### Thay đổi quan trọng: Thêm `type='submit'` cho button

```diff
- <button className='...'>Đăng nhập</button>
+ <button type='submit' className='...'>Đăng nhập</button>
```

`<button>` không có `type` — **mặc định là `type='submit'`** theo HTML spec. Tuy nhiên, khai báo tường minh giúp:
- Code rõ ràng, người đọc biết ngay intent
- Tránh bug khi có nhiều button trong form — chỉ button `type='submit'` mới trigger `onSubmit`
- Một số linter/formatter yêu cầu khai báo tường minh `type` cho button

---

## So Sánh Trước/Sau

```
TRƯỚC:                                    SAU:
┌─ Register.tsx ─────────────────────┐   ┌─ Register.tsx ────────────────────────────────┐
│ <form>                             │   │ interface FormData { email, password, ... }   │
│   <input type='email' name='email'>│   │ useForm<FormData>() → register, errors        │
│   <div></div>  ← Luôn rỗng        │   │                                               │
│   <input type='password' ...>      │   │ <form onSubmit={onSubmit}>                    │
│   <button>Đăng ký</button>         │   │   <input {...register('email', rules.email)}>  │
│   → Bấm submit: Không có gì       │   │   <div>{errors.email?.message}</div>           │
│ </form>                            │   │   <input {...register('password', rules.pw)}> │
└────────────────────────────────────┘   │   <button type='submit'>Đăng ký</button>      │
                                         │   → Bấm submit: Validate → Lỗi hoặc log data  │
                                         │ </form>                                        │
                                         └────────────────────────────────────────────────┘
```

---

## Luồng Hoạt Động Sau Commit

```
Kịch bản 1 — User bấm Submit với form trống:

User bấm [Đăng ký]
    ↓
handleSubmit validate tất cả fields
    ↓
email: '' → vi phạm 'required' → errors.email = { message: 'Email là bắt buộc' }
password: '' → vi phạm 'required' → errors.password = { message: 'Password là bắt buộc' }
confirm_password: '' → tương tự
    ↓
React re-render → errors object có giá trị
    ↓
{errors.email?.message} hiển thị: "Email là bắt buộc"
{errors.confirm_password?.message} hiển thị: "Nhập lại password là bắt buộc"

─────────────────────────────────────────

Kịch bản 2 — User nhập email sai định dạng:

User nhập "notanemail", bấm [Đăng ký]
    ↓
email: 'notanemail' → pass 'required', fail 'pattern'
    ↓
errors.email = { message: 'Email không đúng định dạng' }
    ↓
Hiển thị: "Email không đúng định dạng"

─────────────────────────────────────────

Kịch bản 3 — User nhập đầy đủ và hợp lệ:

User nhập email hợp lệ, password ≥ 6 ký tự, confirm_password ≥ 6 ký tự
Bấm [Đăng ký]
    ↓
Tất cả rules pass → errors = {}
    ↓
callback(data) được gọi
    ↓
console.log({ email: '...', password: '...', confirm_password: '...' })
(Chưa gọi API — sẽ làm ở commit sau)
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **React Hook Form** | Thư viện quản lý form dùng uncontrolled inputs (dùng ref thay vì state) — hiệu năng cao hơn cách dùng `useState` vì không re-render mỗi khi gõ phím. |
| **`register(name, rules)`** | Gắn một input vào React Hook Form. Trả về object props cần thiết (`name`, `ref`, `onChange`, `onBlur`) — dùng spread `{...register(...)}` để áp dụng vào input. |
| **`handleSubmit(callback)`** | Higher-Order Function nhận callback xử lý dữ liệu, trả về event handler cho form. Tự validate trước, chỉ gọi callback khi tất cả pass. |
| **`formState.errors`** | Object chứa thông báo lỗi của từng field. Key là tên field, value là `{ type, message }`. Rỗng khi không có lỗi, tự động cập nhật sau mỗi lần submit. |
| **Optional Chaining `?.`** | `obj?.prop` trả về `undefined` thay vì throw error khi `obj` là `null`/`undefined`. Tránh crash khi đọc `errors.field.message` lúc field chưa có lỗi. |
| **`FormData` interface** | Khai báo shape của dữ liệu form để TypeScript type-check tên field và kiểu dữ liệu. Truyền vào `useForm<FormData>()` để có autocomplete và type safety. |
| **Centralized rules** | Tách validate rules ra file `rules.ts` riêng — tránh lặp code, dễ thay đổi, nhiều form có thể dùng chung cùng rules. |
| **`min-h` cho error div** | Chiều cao tối thiểu cho container hiển thị lỗi — giữ layout ổn định, tránh các element bên dưới bị đẩy lên/xuống (layout shift) khi lỗi xuất hiện/biến mất. |
| **`type='submit'` tường minh** | Button trong form mặc định là `type='submit'`. Khai báo tường minh giúp code rõ ràng hơn và tránh nhầm lẫn khi có nhiều button trong cùng form. |
