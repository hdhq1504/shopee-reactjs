# 92c7586 — feat: Active NavLink cho UserSideNav và tách component InputFile

## Tổng Quan

Commit này thực hiện **2 việc chính**:

1. **Tách `InputFile` thành component riêng** — Di chuyển toàn bộ logic chọn file ảnh (hidden input, validate, reset) ra khỏi `Profile.tsx` thành component có thể tái sử dụng.
2. **Active NavLink cho UserSideNav** — Đổi `<Link>` thành `<NavLink>` để menu bên trái tự động highlight link đang active (màu cam) dựa trên URL hiện tại.

---

## Các File Thay Đổi

| File | Loại | Vai trò |
|------|------|---------|
| `src/components/InputFile/InputFile.tsx` | Tạo mới | Component tái sử dụng cho chọn + validate file ảnh |
| `src/components/InputFile/index.ts` | Tạo mới | Barrel export |
| `src/pages/User/pages/Profile/Profile.tsx` | Sửa | Bỏ logic file, dùng `<InputFile />` thay thế |
| `src/pages/User/components/UserSideNav/UserSideNav.tsx` | Sửa | Đổi `Link` → `NavLink` + classNames động |

---

# Phần 1: Tách Component `InputFile`

## Vấn Đề Trước Khi Tách

`Profile.tsx` đang chứa quá nhiều trách nhiệm:
- Logic form (react-hook-form, validate, submit)
- Logic upload ảnh (mutation API)
- Logic **chọn file** (hidden input, ref click, validate type/size, reset value, toast lỗi)

Logic "chọn file" hoàn toàn **độc lập** — không liên quan đến data của form profile. Nếu sau này cần upload ảnh ở trang khác (trang sản phẩm, trang tin tức...), sẽ phải copy-paste toàn bộ đoạn code đó.

**Nguyên tắc Single Responsibility:** Mỗi component chỉ nên có một trách nhiệm chính. `Profile.tsx` nên lo về quản lý form profile, còn việc chọn file nên giao cho component riêng.

---

## `InputFile.tsx` — Component Mới

```tsx
import { useRef } from 'react'
import { toast } from 'react-toastify'
import config from '~/constants/config'

interface Props {
  onChange?: (file?: File) => void   // Callback trả file hợp lệ cho parent
}

export default function InputFile({ onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileFromLocal = event.target.files?.[0]

    // Reset value ngay sau khi đọc file — fix bug chọn lại cùng file
    fileInputRef.current?.setAttribute('value', '')

    if (
      fileFromLocal &&
      (fileFromLocal.size >= config.maxSizeUploadAvatar || !fileFromLocal.type.includes('image'))
    ) {
      toast.error(`Dung lượng file tối đa 1 MB. Định dạng:.JPEG, .PNG`, {
        position: 'top-center'
      })
    } else {
      onChange && onChange(fileFromLocal)   // Hợp lệ → trả file lên parent
    }
  }

  const handleUpload = () => {
    fileInputRef.current?.click()   // Kích hoạt hộp thoại chọn file
  }

  return (
    <>
      {/* Input ẩn — browser mở hộp thoại khi được click */}
      <input
        className='hidden'
        type='file'
        accept='.jpg,.jpeg,.png'
        ref={fileInputRef}
        onChange={onFileChange}
        onClick={(event) => {
          ;(event.target as any).value = null   // Reset trước khi mở hộp thoại
        }}
      />

      {/* Nút đẹp — thay thế UI mặc định xấu của input file */}
      <button
        className='flex h-10 items-center justify-end rounded-sm border bg-white px-6 text-sm text-gray-600 shadow-sm'
        type='button'
        onClick={handleUpload}
      >
        Chọn ảnh
      </button>
    </>
  )
}
```

### Component này đóng gói những gì?

| Trách nhiệm | Nằm trong `InputFile` | Parent cần làm |
|-------------|:---:|---|
| Hidden input + kích hoạt click | Có | Không cần biết |
| Reset value (fix bug chọn lại cùng file) | Có | Không cần biết |
| Validate type (image) + size (≤ 1MB) | Có | Không cần biết |
| Toast lỗi khi file không hợp lệ | Có | Không cần biết |
| Xử lý file hợp lệ | Không | Nhận qua `onChange` callback |

### API đơn giản — chỉ 1 prop

```tsx
<InputFile onChange={(file) => setFile(file)} />
```

Parent chỉ cần truyền một callback `onChange`. Khi user chọn file hợp lệ, callback nhận `File` object. Khi file không hợp lệ, callback không được gọi — toast lỗi tự hiện.

**Nguyên tắc thiết kế component tốt:** API đơn giản, đóng gói logic phức tạp bên trong. Parent không cần biết chi tiết implementation — "truyền onChange → nhận File khi hợp lệ".

---

## `Profile.tsx` — Sau Khi Tách

### Code bị xóa (di chuyển vào InputFile):

```diff
- import { useContext, useEffect, useMemo, useRef, useState } from 'react'
+ import { useContext, useEffect, useMemo, useState } from 'react'
                            ↑ Bỏ useRef — đã chuyển vào InputFile

- const fileInputRef = useRef<HTMLInputElement>(null)

- const onFileChange = (event) => {          ← 12 dòng logic validate
-   const fileFromLocal = event.target.files?.[0]
-   if (!fileFromLocal.type.includes('image')) { ... }
-   if (fileFromLocal.size >= config.maxSizeUploadAvatar) { ... }
-   ...
- }
- const handleUpload = () => { fileInputRef.current?.click() }

+ const handleChangeFile = (file?: File) => {  ← Chỉ còn 1 dòng
+   setFile(file)
+ }
```

### JSX thay đổi:

```diff
  {/* TRƯỚC: ~5 dòng */}
- <input className='hidden' type='file' accept='.jpg,.jpeg,.png'
-        ref={fileInputRef} onChange={onFileChange}
-        onClick={(event) => { ... }} />
- <input type='hidden' {...register('avatar')} />
- <button type='button' onClick={handleUpload}>Chọn ảnh</button>

  {/* SAU: 1 dòng */}
+ <InputFile onChange={handleChangeFile} />
```

### So sánh trước/sau:

```
TRƯỚC Profile.tsx (~255 dòng):           SAU Profile.tsx (~224 dòng):
┌────────────────────────────────┐       ┌────────────────────────────────┐
│ Form logic (useForm, validate) │       │ Form logic (useForm, validate) │
│ Upload logic (mutation)        │       │ Upload logic (mutation)        │
│ File logic: (ref, validate,    │  →    │ <InputFile onChange={...} />   │  ← 1 dòng
│   reset, hidden input, button) │       │                                │
└────────────────────────────────┘       └────────────────────────────────┘
                                          ↑ Gọn hơn ~30 dòng
```

---

# Phần 2: Active NavLink Cho UserSideNav

## Vấn Đề Trước Đây

Thanh menu bên trái dùng `<Link>` với `className` cố định — link nào cũng trông giống nhau, **không ai biết đang ở trang nào**:

```tsx
// TRƯỚC — className cứng, luôn một màu
<Link to={path.profile} className='text-orange'>Tài khoản của tôi</Link>
<Link to={path.changePassword} className='text-gray-600'>Đổi mật khẩu</Link>
<Link to={path.historyPurchase} className='text-gray-600'>Đơn mua</Link>
```

Kết quả:
```
URL: /user/password — Đang ở trang Đổi mật khẩu, nhưng nhìn menu không biết!
┌──────────────────────┐
│ 🟠 Tài khoản        │  ← Luôn cam (nghĩ đang ở đây, nhưng không phải!)
│ ⚫ Đổi mật khẩu    │  ← Luôn xám (nghĩ không active, nhưng thực ra đang ở đây)
│ ⚫ Đơn mua          │
└──────────────────────┘
```

## Giải Pháp: `<NavLink>` + `classNames`

### `<NavLink>` là gì?

`NavLink` là phiên bản nâng cấp của `Link` trong React Router. Tính năng đặc biệt của nó: `className` có thể là **một hàm** nhận vào object `{ isActive }` — `isActive` là `true` khi URL hiện tại match với `to` prop.

```tsx
// Link — className luôn cố định, không biết active hay không
<Link to='/user/profile' className='text-orange'>Tài khoản</Link>

// NavLink — className là hàm, biết trạng thái active
<NavLink
  to='/user/profile'
  className={({ isActive }) => isActive ? 'text-orange' : 'text-gray-600'}
>
  Tài khoản
</NavLink>
```

### Code mới trong `UserSideNav.tsx`:

```tsx
import classNames from 'classnames'
import { NavLink } from 'react-router-dom'

<NavLink
  to={path.profile}
  className={({ isActive }) =>
    classNames('flex items-center capitalize transition-colors', {
      'text-orange': isActive,      // Cam khi đang ở trang này
      'text-gray-600': !isActive    // Xám khi không ở trang này
    })
  }
>
  Tài khoản của tôi
</NavLink>
```

### Thư viện `classnames` hoạt động thế nào?

```typescript
import classNames from 'classnames'

classNames(
  'class-luôn-áp-dụng',   // Kiểu string — lúc nào cũng có trong kết quả
  {
    'class-có-điều-kiện': true,    // Điều kiện true → thêm class
    'class-khác': false             // Điều kiện false → không thêm
  }
)
// → "class-luôn-áp-dụng class-có-điều-kiện"
```

Ứng dụng cụ thể:

```typescript
classNames('flex items-center capitalize transition-colors', {
  'text-orange': isActive,      // true → thêm
  'text-gray-600': !isActive    // false → không thêm
})
// Khi active: "flex items-center capitalize transition-colors text-orange"
// Khi không active: "flex items-center capitalize transition-colors text-gray-600"
```

### Kết quả thực tế:

```
URL: /user/profile                    URL: /user/password
┌──────────────────────────┐          ┌──────────────────────────┐
│ 🟠 Tài khoản của tôi    │          │ ⚫ Tài khoản của tôi    │
│ ⚫ Đổi mật khẩu         │          │ 🟠 Đổi mật khẩu         │
│ ⚫ Đơn mua              │          │ ⚫ Đơn mua              │
└──────────────────────────┘          └──────────────────────────┘
       Profile active                       Password active
```

### So sánh `Link` vs `NavLink`:

| Tính năng | `<Link>` | `<NavLink>` |
|-----------|---------|------------|
| Chức năng | Navigate đến URL | Navigate + biết trạng thái active |
| `className` | String cố định | String hoặc **Function** nhận `{ isActive }` |
| Khi nào dùng | Link bình thường (logo, card sản phẩm...) | Navigation menu (sidebar, tabs, breadcrumb...) |

### Áp dụng cho cả 3 menu items:

```tsx
{/* Item 1: Tài khoản */}
<NavLink to={path.profile} className={({ isActive }) => classNames(...)}>
  Tài khoản của tôi
</NavLink>

{/* Item 2: Đổi mật khẩu */}
<NavLink to={path.changePassword} className={({ isActive }) => classNames('mt-4 ...', {...})}>
  Đổi mật khẩu
</NavLink>

{/* Item 3: Đơn mua */}
<NavLink to={path.historyPurchase} className={({ isActive }) => classNames('mt-4 ...', {...})}>
  Đơn mua
</NavLink>
```

Avatar và "Sửa hồ sơ" phía trên vẫn dùng `<Link>` bình thường — vì chúng không phải menu item cần highlight active state.

---

## Tóm Tắt Trước/Sau

```
TRƯỚC:
┌─ Profile.tsx (255 dòng) ───────────────────────┐
│ useRef, onFileChange, handleUpload             │  ← Logic chọn file nằm đây
│ <input hidden>, <button>Chọn ảnh</button>     │  ← UI chọn file nằm đây
│ Form logic, Upload logic, JSX...              │
└────────────────────────────────────────────────┘

┌─ UserSideNav.tsx ──────────────────────────────┐
│ <Link className='text-orange'>Tài khoản</Link>│  ← Luôn cam (cứng)
│ <Link className='text-gray'>Đổi MK</Link>    │  ← Luôn xám (cứng)
└────────────────────────────────────────────────┘

SAU:
┌─ InputFile.tsx (51 dòng) ──────────────────────┐
│ useRef, onFileChange, handleUpload             │  ← Logic chọn file tách ra đây
│ <input hidden>, <button>Chọn ảnh</button>     │  ← UI chọn file tách ra đây
└────────────────────────────────────────────────┘

┌─ Profile.tsx (224 dòng) ───────────────────────┐
│ <InputFile onChange={handleChangeFile} />      │  ← 1 dòng duy nhất
│ Form logic, Upload logic, JSX...              │
└────────────────────────────────────────────────┘

┌─ UserSideNav.tsx ──────────────────────────────┐
│ <NavLink className={({isActive}) => ...}>     │  ← Dynamic: cam/xám theo URL
│ <NavLink className={({isActive}) => ...}>     │
└────────────────────────────────────────────────┘
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Component Extraction** | Tách logic + UI ra component riêng khi: (1) code quá dài, (2) có thể tái sử dụng, (3) có trách nhiệm độc lập. Giúp mỗi component tập trung vào một việc duy nhất. |
| **Callback Props pattern** | Component con nhận `onChange` callback từ parent. Khi có sự kiện (file được chọn), gọi callback trả dữ liệu lên parent. Parent không biết cơ chế nội bộ — chỉ biết "khi onChange được gọi thì có file hợp lệ". |
| **`<NavLink>`** | Phiên bản nâng cấp của `<Link>` — biết trạng thái active. `className` có thể là function nhận `{ isActive }` để áp dụng style khác nhau tùy trạng thái URL. |
| **`classNames` library** | Utility kết hợp CSS class string + object có điều kiện. Tránh viết template literal phức tạp: thay vì `` `base ${isActive ? 'active' : 'inactive'}` `` → dùng `classNames('base', { 'active': isActive, 'inactive': !isActive })`. |
| **Barrel export (`index.ts`)** | `export { default } from './InputFile'` → cho phép import gọn: `from '~/components/InputFile'` thay vì `from '~/components/InputFile/InputFile'`. |
| **Single Responsibility Principle** | Mỗi component/module chỉ nên có một lý do để thay đổi. `InputFile` thay đổi chỉ khi logic chọn file thay đổi. `Profile` thay đổi chỉ khi form profile thay đổi. |
