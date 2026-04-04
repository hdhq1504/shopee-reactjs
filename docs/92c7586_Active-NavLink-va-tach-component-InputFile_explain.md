# 92c7586 — feat: Active NavLink cho UserSideNav và tách component InputFile

## 🎯 Tổng Quan

Commit này thực hiện **2 việc chính**:

1. **Tách `InputFile` thành component riêng** — Di chuyển toàn bộ logic chọn file ảnh (hidden input, validate, reset) ra khỏi `Profile.tsx` thành component tái sử dụng.
2. **Active NavLink cho UserSideNav** — Đổi `<Link>` thành `<NavLink>` để menu bên trái **tự động highlight** link đang active (cam) dựa trên URL hiện tại.

---

## 📁 Tổng Quan Các File Thay Đổi

| File | Loại | Vai trò |
|------|------|---------|
| `src/components/InputFile/InputFile.tsx` | **Tạo mới** | Component tái sử dụng cho chọn + validate file ảnh |
| `src/components/InputFile/index.ts` | **Tạo mới** | Barrel export |
| `src/pages/User/pages/Profile/Profile.tsx` | **Sửa** | Bỏ logic file, dùng `<InputFile />` thay thế |
| `src/pages/User/components/UserSideNav/UserSideNav.tsx` | **Sửa** | Đổi `Link` → `NavLink` + classNames dynamic |

---

# PHẦN 1: Tách Component `InputFile`

## Vấn đề trước khi tách

`Profile.tsx` đang chứa quá nhiều thứ:
- Logic form (react-hook-form, validate, submit)
- Logic upload ảnh (mutation)
- Logic **chọn file** (hidden input, ref, validate type/size, reset value)

Trong đó, logic "chọn file" hoàn toàn **độc lập** — không phụ thuộc vào form profile. Nếu sau này cần upload ảnh ở trang khác (ChangePassword, Chat...), sẽ phải copy-paste.

## 📁 `InputFile.tsx` — Component Mới

```tsx
import { useRef } from 'react'
import { toast } from 'react-toastify'
import config from '~/constants/config'

interface Props {
  onChange?: (file?: File) => void       // ← Callback trả file cho parent
}

export default function InputFile({ onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileFromLocal = event.target.files?.[0]
    fileInputRef.current?.setAttribute('value', '')
    if (fileFromLocal && (fileFromLocal.size >= config.maxSizeUploadAvatar || !fileFromLocal.type.includes('image'))) {
      toast.error(`Dụng lượng file tối đa 1 MB. Định dạng:.JPEG, .PNG`, {
        position: 'top-center'
      })
    } else {
      onChange && onChange(fileFromLocal)    // ← Hợp lệ → gọi callback trả file cho parent
    }
  }

  const handleUpload = () => {
    fileInputRef.current?.click()
  }

  return (
    <>
      <input
        className='hidden'
        type='file'
        accept='.jpg,.jpeg,.png'
        ref={fileInputRef}
        onChange={onFileChange}
        onClick={(event) => {
          ;(event.target as any).value = null
        }}
      />
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
| Hidden input + ref click | ✅ | Không cần biết |
| Reset value (fix bug chọn lại cùng file) | ✅ | Không cần biết |
| Validate type (image) + size (≤ 1MB) | ✅ | Không cần biết |
| Toast lỗi | ✅ | Không cần biết |
| Xử lý file hợp lệ | ❌ | Nhận qua `onChange` callback |

### API đơn giản — chỉ 1 prop:

```tsx
<InputFile onChange={(file) => setFile(file)} />
```

Parent chỉ cần truyền 1 callback `onChange` — khi user chọn file hợp lệ, callback sẽ nhận File object.

> 💡 **Nguyên tắc thiết kế:** Component tốt = API đơn giản + đóng gói logic phức tạp bên trong. Parent không cần biết "bên trong có hidden input, ref, reset value..." — chỉ cần biết "truyền onChange → nhận File".

---

## 📁 `Profile.tsx` — Sau Khi Tách

### Code bị xóa (di chuyển sang InputFile):

```diff
- import { useContext, useEffect, useMemo, useRef, useState } from 'react'
+ import { useContext, useEffect, useMemo, useState } from 'react'
                                        ↑ Bỏ useRef (đã vào InputFile)

- import config from '~/constants/config'
+ import InputFile from '~/components/InputFile'
  ↑ Không cần config nữa (InputFile tự validate)
```

```diff
- const fileInputRef = useRef<HTMLInputElement>(null)     ← Chuyển vào InputFile

- const onFileChange = (event) => { ... }                 ← 12 dòng logic validate
- const handleUpload = () => { fileInputRef.current?.click() }
+ const handleChangeFile = (file?: File) => {             ← Chỉ còn 1 dòng
+   setFile(file)
+ }
```

```diff
  {/* TRƯỚC: ~20 dòng JSX (hidden input, onClick reset, button) */}
- <input className='hidden' type='file' ... />
- <input type='hidden' {...register('avatar')} />
- <button type='button' onClick={handleUpload}>Chọn ảnh</button>

  {/* SAU: 1 dòng duy nhất */}
+ <InputFile onChange={handleChangeFile} />
```

### So sánh trước/sau:

```
TRƯỚC Profile.tsx (~255 dòng):              SAU Profile.tsx (~224 dòng):
┌────────────────────────────────┐          ┌────────────────────────────────┐
│ Form logic (useForm, validate) │          │ Form logic (useForm, validate) │
│ Upload logic (mutation)        │          │ Upload logic (mutation)        │
│ ✂ File logic (ref, validate,   │    →     │ <InputFile onChange={...} />   │  ← 1 dòng
│   reset, hidden input, button) │          │                                │
│ JSX (~250 dòng)               │          │ JSX (~220 dòng)               │
└────────────────────────────────┘          └────────────────────────────────┘
                                                              ↑ Gọn hơn ~30 dòng
```

---

# PHẦN 2: Active NavLink Cho UserSideNav

## Vấn đề trước đây

Thanh menu bên trái dùng `<Link>` — tất cả link đều cùng màu, **không biết đang ở trang nào**:

```
┌──────────────────────┐
│ Tài khoản của tôi    │  ← text-orange (cứng)
│ Đổi mật khẩu        │  ← text-gray-600 (cứng)
│ Đơn mua             │  ← text-gray-600 (cứng)
└──────────────────────┘
```

"Tài khoản của tôi" luôn cam dù user đang ở trang nào — vì dùng `className` cố định.

## Giải pháp: `<NavLink>` + `classNames`

### `<NavLink>` là gì?

`NavLink` là phiên bản nâng cấp của `Link` trong React Router. Nó có thêm 1 khả năng đặc biệt: **biết mình có đang active hay không** (URL hiện tại match với `to` prop).

```tsx
// Link — className luôn cố định
<Link to='/user/profile' className='text-orange'>Tài khoản</Link>

// NavLink — className là HÀM, nhận { isActive }
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
      'text-orange': isActive,        // ← Cam khi active
      'text-gray-600': !isActive      // ← Xám khi không active
    })
  }
>
  Tài khoản của tôi
</NavLink>
```

### `classNames` library hoạt động thế nào?

```typescript
import classNames from 'classnames'

classNames('base-class', {
  'active-class': true,       // ← Điều kiện true → thêm class
  'inactive-class': false     // ← Điều kiện false → bỏ class
})
// → "base-class active-class"
```

### Kết quả thực tế:

```
URL: /user/profile                    URL: /user/password
┌──────────────────────────┐          ┌──────────────────────────┐
│ 🟠 Tài khoản của tôi     │          │ ⚫ Tài khoản của tôi     │
│ ⚫ Đổi mật khẩu          │          │ 🟠 Đổi mật khẩu          │
│ ⚫ Đơn mua               │          │ ⚫ Đơn mua               │
└──────────────────────────┘          └──────────────────────────┘
       ↑ Profile active                     ↑ Password active
```

### So sánh `Link` vs `NavLink`:

| | `<Link>` | `<NavLink>` |
|---|---|---|
| **Chức năng** | Navigate đến URL | Navigate + biết trạng thái active |
| **`className`** | String cố định | String HOẶC **Function** nhận `{ isActive }` |
| **Khi nào dùng** | Link bình thường (logo, sản phẩm...) | Menu navigation (sidebar, tabs, breadcrumb...) |
| **Performance** | Nhẹ hơn một chút | Nặng hơn chút (phải so sánh URL) |

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

> 💡 Lưu ý: Avatar và "Sửa hồ sơ" phía trên vẫn dùng `<Link>` bình thường — vì chúng không phải menu item cần highlight.

---

## 🔗 Tóm Tắt Trước/Sau

```
TRƯỚC:
┌─ Profile.tsx (255 dòng) ──────────────────────┐
│ useRef, onFileChange, handleUpload            │  ← Logic chọn file nằm ĐÂY
│ <input hidden>, <button>Chọn ảnh</button>     │  ← UI chọn file nằm ĐÂY
│ Form logic, Upload logic, JSX...              │
└───────────────────────────────────────────────┘

┌─ UserSideNav.tsx ─────────────────────────────┐
│ <Link className='text-orange'>Tài khoản</Link>│  ← Luôn cam (cứng)
│ <Link className='text-gray'>Đổi MK</Link>     │  ← Luôn xám (cứng)
└───────────────────────────────────────────────┘

SAU:
┌─ InputFile.tsx (51 dòng) ─────────────────────┐
│ useRef, onFileChange, handleUpload            │  ← Logic chọn file tách RA ĐÂY
│ <input hidden>, <button>Chọn ảnh</button>     │  ← UI chọn file tách RA ĐÂY
└───────────────────────────────────────────────┘

┌─ Profile.tsx (224 dòng) ──────────────────────┐
│ <InputFile onChange={handleChangeFile} />      │  ← 1 dòng duy nhất
│ Form logic, Upload logic, JSX...              │
└───────────────────────────────────────────────┘

┌─ UserSideNav.tsx ─────────────────────────────┐
│ <NavLink className={({isActive}) => ...}>     │  ← Dynamic: cam/xám theo URL
│ <NavLink className={({isActive}) => ...}>     │
└───────────────────────────────────────────────┘
```

---

## 📌 Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Component Extraction** | Tách logic + UI ra component riêng khi: (1) code quá dài, (2) có thể tái sử dụng, (3) trách nhiệm riêng biệt |
| **Callback Props pattern** | Component con nhận `onChange` callback từ parent — khi có sự kiện, gọi callback trả dữ liệu lên |
| **`<NavLink>`** | Phiên bản nâng cấp của `<Link>` — biết trạng thái active, cho phép `className` là function nhận `{ isActive }` |
| **`classNames` library** | Utility nối class CSS có điều kiện: `classNames('base', { 'active': true })` → `"base active"` |
| **Barrel export (`index.ts`)** | `export default InputFile` → cho phép import gọn: `from '~/components/InputFile'` thay vì `from '~/components/InputFile/InputFile'` |
| **Single Responsibility** | Mỗi component chỉ nên có 1 trách nhiệm: InputFile = chọn file, Profile = quản lý form profile |
