# c28219c — feat: Validate khi upload ảnh

## Tổng Quan

Commit này tiếp tục cải thiện chức năng upload ảnh, tập trung vào **3 vấn đề**:

1. Đưa giới hạn dung lượng (`1 MB`) vào file `config.ts` thay vì viết số thẳng vào code (magic number).
2. Đơn giản hóa logic validate — gom 2 rule riêng lẻ thành 1 câu điều kiện ngắn gọn.
3. Fix bug: user chọn lại **đúng file cũ** thì `onChange` không trigger — xử lý bằng kỹ thuật reset value.

---

## Các File Thay Đổi

| File | Loại thay đổi | Vai trò |
|------|---------------|---------|
| `src/pages/User/pages/Profile/Profile.tsx` | Sửa | Chỉnh lại validate khi chọn file + fix bug chọn lại cùng file |
| `src/constants/config.ts` | Sửa | Thêm `maxSizeUploadAvatar` |

---

## 1. `config.ts` — Gom Magic Number Vào Cấu Hình

### Trước:

```typescript
const config = {
  baseUrl: 'https://api-ecom.duthanhduoc.com/'
}
```

### Sau:

```typescript
const config = {
  baseUrl: 'https://api-ecom.duthanhduoc.com/',
  maxSizeUploadAvatar: 1048576    // 1 MB = 1024 KB = 1024 × 1024 bytes
}
```

### "Magic Number" là gì và tại sao nên tránh?

**Magic Number** là những con số xuất hiện trong code mà không có giải thích ý nghĩa:

```typescript
// Magic Number — đọc phải tự tính: "Ừ, 1024 × 1024, à ra 1 MB"
if (fileFromLocal.size > 1024 * 1024) { ... }
```

Vấn đề:
- Người đọc lần đầu không biết ngay con số đó có nghĩa gì
- Nếu cần đổi limit từ 1MB sang 2MB, phải tìm tất cả chỗ dùng `1024 * 1024`
- Nếu nhiều component cùng validate → mỗi nơi một con số khác nhau

```typescript
// Named Constant — đọc ngay: "à, max size upload avatar là..."
if (fileFromLocal.size >= config.maxSizeUploadAvatar) { ... }
```

Lợi ích:
- Dễ đọc và tự giải thích
- Đổi từ 1MB sang 2MB? Sửa `config.ts` ở một chỗ duy nhất
- Tất cả component dùng chung thì đều được cập nhật

---

## 2. `Profile.tsx` — Validate Ảnh Đơn Giản Hóa

### Trước (dài, nhiều `if` riêng lẻ):

```typescript
const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const fileFromLocal = event.target.files?.[0]
  if (!fileFromLocal) return

  // Check 1: Định dạng
  const isValidType = ['image/jpeg', 'image/png'].includes(fileFromLocal.type)
  if (!isValidType) {
    setError('avatar', { message: '...' })
    toast.error('Định dạng sai')
    return
  }

  // Check 2: Dung lượng
  if (fileFromLocal.size > 1024 * 1024) {
    setError('avatar', { message: '...' })
    toast.error('Quá 1 MB')
    return
  }

  clearErrors('avatar')
  setValue('avatar', fileFromLocal.name, { shouldValidate: true, shouldDirty: true })
  setFile(fileFromLocal)
}
```

### Sau (gọn, 1 điều kiện duy nhất):

```typescript
const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const fileFromLocal = event.target.files?.[0]
  fileInputRef.current?.setAttribute('value', '')   // Reset input sau khi đọc file

  if (
    fileFromLocal &&
    (fileFromLocal.size >= config.maxSizeUploadAvatar || !fileFromLocal.type.includes('image'))
  ) {
    toast.error(`Dung lượng file tối đa 1 MB. Định dạng:.JPEG, .PNG`, {
      position: 'top-center'
    })
  } else {
    setFile(fileFromLocal)
  }
}
```

### Phân tích điều kiện:

```typescript
fileFromLocal &&                                         // Có chọn file
(
  fileFromLocal.size >= config.maxSizeUploadAvatar    // QUÁ LỚN (≥ 1MB)
  ||                                                   // HOẶC
  !fileFromLocal.type.includes('image')                // KHÔNG PHẢI ẢNH
)
```

| File chọn | Size ≥ 1MB | Type là ảnh | Kết quả |
|-----------|:---:|:---:|---------|
| `photo.jpg` (500KB) | Không | Có | Hợp lệ → `setFile(file)` |
| `photo.png` (2MB) | Có | Có | Báo lỗi (quá lớn) |
| `doc.pdf` (100KB) | Không | Không | Báo lỗi (không phải ảnh) |
| `video.mp4` (5MB) | Có | Không | Báo lỗi (cả hai) |

### So sánh 2 cách kiểm tra định dạng:

**Cách cũ — Whitelist (chặt, chỉ cho JPEG và PNG):**

```typescript
['image/jpeg', 'image/png'].includes(fileFromLocal.type)
// WebP, GIF, BMP... đều bị chặn
```

**Cách mới — Contains check (mở hơn, cho mọi loại ảnh):**

```typescript
fileFromLocal.type.includes('image')
// image/jpeg ✅, image/png ✅, image/webp ✅, image/gif ✅
// application/pdf ❌, video/mp4 ❌
```

Tuy nhiên, HTML input vẫn giới hạn:

```tsx
<input accept='.jpg,.jpeg,.png' />
```

Attribute `accept` là **gợi ý cho browser** hiển thị chỉ file phù hợp trong hộp thoại. Nhưng user vẫn có thể đổi filter sang "All Files" và chọn file khác → JavaScript check sẽ chặn lại.

### Bỏ `setError` / `clearErrors` cho avatar:

| | Cách cũ | Cách mới |
|---|---|---|
| File không hợp lệ | Toast + `setError('avatar', ...)` → 2 nơi hiển thị lỗi | Chỉ Toast |
| File hợp lệ | `clearErrors('avatar')` + `setValue('avatar')` | Chỉ `setFile(file)` |

Code ngắn hơn, nhưng mất lỗi inline dưới field avatar. Đây là trade-off có chủ ý — toast đủ để thông báo cho user biết ngay.

### Thay đổi nhỏ: `>` thành `>=`

```diff
- fileFromLocal.size > 1024 * 1024         // File đúng 1MB: cho qua
+ fileFromLocal.size >= config.maxSizeUploadAvatar   // File đúng 1MB: cũng chặn
```

Quy tắc rõ ràng hơn: "tối đa 1MB" nghĩa là **dưới** 1MB, không bao gồm đúng 1MB.

---

## 3. Fix Bug: Chọn Lại Cùng File Không Trigger `onChange`

### Mô tả bug:

```
Bước 1: User chọn "avatar.png" → onChange chạy → báo lỗi "ảnh quá lớn"
Bước 2: User resize ảnh, chọn lại "avatar.png" (cùng tên file) → onChange KHÔNG chạy!
Kết quả: Người dùng bối rối, không biết có lỗi hay không
```

### Nguyên nhân:

Browser theo dõi `value` của input file (chứa đường dẫn file). Khi user chọn file:
- Nếu file khác file cũ → `value` thay đổi → browser trigger `onChange`
- Nếu file giống file cũ (cùng tên) → `value` không thay đổi → browser bỏ qua → `onChange` không chạy

### Fix 1: Reset `value` TRƯỚC khi mở hộp thoại (`onClick`)

```tsx
<input
  type='file'
  onClick={(event) => {
    ;(event.target as any).value = null   // Xóa file cũ TRƯỚC khi mở hộp thoại
  }}
  onChange={onFileChange}
/>
```

| Phần | Giải thích |
|------|-----------|
| `;` ở đầu | Bảo vệ khỏi lỗi ASI (Automatic Semicolon Insertion) — JavaScript đôi khi tự thêm `;` sai chỗ nếu dòng trước đó không có |
| `(event.target as any)` | Cast sang `any` vì TypeScript không khai báo `value` là `null`-able cho input type=file |
| `.value = null` | Xóa giá trị cũ của input — sau đó bất kỳ file nào user chọn đều được coi là "mới" |

Luồng sau khi fix:
```
User click input file
    ↓
onClick: value = null (xóa file cũ)
    ↓
Browser mở hộp thoại
    ↓
User chọn "avatar.png" → browser so sánh: null ≠ "avatar.png" → CÓ thay đổi!
    ↓
onChange chạy → onFileChange xử lý ✅
```

### Fix 2: Reset `value` SAU khi xử lý (`setAttribute`)

```typescript
const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const fileFromLocal = event.target.files?.[0]
  fileInputRef.current?.setAttribute('value', '')   // Reset SAU khi đọc file
  // ... xử lý validate ...
}
```

### Tại sao cần 2 lần reset?

```
onClick:        Reset TRƯỚC → đảm bảo onChange luôn trigger khi user chọn file
onFileChange:   Reset SAU   → đảm bảo trạng thái input sạch cho lần chọn tiếp theo
→ Double safety: không bao giờ bị "stuck" với value cũ trong bất kỳ tình huống nào
```

**Hai cách reset input file:**
- `element.value = null` — gán trực tiếp vào DOM property
- `element.setAttribute('value', '')` — thông qua HTML attribute

Cả hai đều hoạt động — commit này dùng cả 2 ở 2 thời điểm khác nhau để đảm bảo an toàn tối đa.

---

## 4. Toast — Gom Thành 1 Message

### Trước — 2 toast riêng biệt:

```typescript
toast.error('Định dạng ảnh không hợp lệ')    // Nếu sai type
toast.error('Dung lượng ảnh vượt quá 1 MB')  // Nếu sai size
```

### Sau — 1 toast chung:

```typescript
toast.error(`Dung lượng file tối đa 1 MB. Định dạng:.JPEG, .PNG`, {
  position: 'top-center'
})
```

| | 2 toast riêng | 1 toast chung |
|---|---|---|
| **Chính xác** | User biết lỗi gì cụ thể | Không rõ lỗi nào |
| **Đơn giản** | Code nhiều nhánh hơn | Code ngắn, một nhánh |
| **UX** | Hai toast có thể chồng nhau | Sạch sẽ, một thông báo |

Trong trường hợp này 1 toast chung đủ — message đã bao gồm cả 2 rule nên user biết cần làm gì.

---

## So Sánh Trước/Sau

```
Commit 30c8fa5 (trước):                   Commit c28219c (sau):
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│ Validate:                       │       │ Validate:                       │
│ - 2 if riêng (type + size)     │  →    │ - 1 if gom (type || size)       │
│ - setError + clearErrors        │       │ - Chỉ toast                     │
│ - 1024 * 1024 (magic number)   │       │ - config.maxSizeUploadAvatar     │
│                                 │       │                                 │
│ Bug:                            │       │ Fix:                            │
│ - Chọn lại cùng file           │  →    │ - onClick: value = null         │
│   → onChange không chạy         │       │ - setAttribute('value', '')     │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

---

## Luồng Hoạt Động Sau Commit

```
1. User bấm "Chọn ảnh"
2. onClick → value = null (reset để lần sau luôn trigger onChange)
3. Browser mở hộp thoại chọn file
4. User chọn "photo.jpg"
5. onChange → onFileChange:
   a) Lấy file: event.target.files[0]
   b) Reset input: setAttribute('value', '')
   c) Kiểm tra: size >= 1MB || type không phải image?
      - Có lỗi → toast.error("Dung lượng tối đa 1 MB. Định dạng: JPEG, PNG")
      - Hợp lệ → setFile(file) → preview hiện ngay trên UI
6. User có thể chọn lại đúng file cũ → onChange vẫn chạy bình thường ✅
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Magic Number → Named Constant** | Thay `1024 * 1024` bằng `config.maxSizeUploadAvatar`. Dễ đọc, dễ bảo trì, thay đổi ở một chỗ. |
| **Input file reset trick** | `value = null` (onClick) + `setAttribute('value', '')` (onChange) — 2 lần reset ở 2 thời điểm để đảm bảo `onChange` luôn trigger kể cả khi chọn lại cùng file. |
| **`>` vs `>=`** | `> 1MB` cho phép file đúng 1MB, `>= 1MB` chặn cả file đúng 1MB. Dùng `>=` nhất quán với giải thích "tối đa 1MB". |
| **MIME type check** | `file.type.includes('image')` mở hơn whitelist `['image/jpeg', 'image/png']` — cho phép thêm định dạng ảnh mới mà không cần sửa code. |
| **`accept` attribute** | Chỉ là gợi ý cho browser hiển thị filter trong hộp thoại. Không chặn thật sự — JavaScript phải check lại để đảm bảo. |
| **ASI safe semicolon** | `;(expr)` — dấu `;` ở đầu dòng là "biện pháp phòng thủ" tránh lỗi khi JavaScript Automatic Semicolon Insertion thêm `;` sai chỗ. Phổ biến trong IIFE và expression statement. |
| **Toast vs Inline Error** | Toast = thông báo nhanh, tự biến mất, phù hợp khi cần báo lỗi ngay. Inline error = hiện dưới field, tồn tại lâu, phù hợp khi user cần sửa dữ liệu. |
