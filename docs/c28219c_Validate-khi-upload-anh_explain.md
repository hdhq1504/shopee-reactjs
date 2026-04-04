# c28219c — feat: Validate khi upload ảnh

## 🎯 Tổng Quan

Commit này tiếp tục cải thiện chức năng upload ảnh, tập trung vào **3 vấn đề**:

1. Đưa giới hạn dung lượng (`1 MB`) vào file `config.ts` thay vì hard-code.
2. Đơn giản hóa logic validate — gom 2 rule riêng lẻ thành 1 câu điều kiện ngắn gọn.
3. Fix bug: user chọn lại **đúng file cũ** thì `onChange` không trigger → xử lý bằng reset value.

> 💡 Nếu commit `30c8fa5` làm cho "upload ảnh hoạt động", thì commit này làm cho "chọn ảnh và validate mượt hơn".

---

## 📁 Tổng Quan Các File Thay Đổi

| File | Loại thay đổi | Vai trò |
|------|---------------|---------|
| `src/pages/User/pages/Profile/Profile.tsx` | Sửa | Chỉnh lại validate khi chọn file + fix bug chọn lại cùng file |
| `src/constants/config.ts` | Sửa | Thêm `maxSizeUploadAvatar` |

---

## 📁 1. `config.ts` — Gom Magic Number Vào Cấu Hình

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
  maxSizeUploadAvatar: 1048576                      // ← MỚI
}
```

### `1048576` là gì?

```
1 MB = 1024 KB = 1024 × 1024 bytes = 1.048.576 bytes
```

### Tại sao nên đưa vào config?

**Trước — Magic Number (số ám, khó hiểu):**
```typescript
if (fileFromLocal.size > 1024 * 1024)   // Đọc code phải tự tính: "À, 1 MB"
```

**Sau — Named Constant (tên rõ ràng):**
```typescript
if (fileFromLocal.size >= config.maxSizeUploadAvatar)   // Đọc ngay: "max size upload avatar"
```

**Lợi ích:**
1. **Dễ đọc** — biết ngay ý nghĩa con số
2. **Dễ sửa** — đổi từ 1MB sang 2MB? Sửa 1 chỗ duy nhất
3. **Tránh lặp** — nếu nhiều component cùng validate → đều import từ config

> 💡 **Anti-pattern "Magic Number":** Bất kỳ số nào xuất hiện trong code mà không rõ ý nghĩa (1024, 86400, 3600...) đều nên được đặt tên qua constant hoặc config.

---

## 📁 2. `Profile.tsx` — Validate Ảnh Đơn Giản Hóa

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
  fileInputRef.current?.setAttribute('value', '')                          // ← MỚI: Reset input

  if (fileFromLocal && (fileFromLocal.size >= config.maxSizeUploadAvatar || !fileFromLocal.type.includes('image'))) {
    toast.error(`Dụng lượng file tối đa 1 MB. Định dạng:.JPEG, .PNG`, {
      position: 'top-center'
    })
  } else {
    setFile(fileFromLocal)
  }
}
```

### Phân tích điều kiện:

```typescript
fileFromLocal &&                                      // Có chọn file
(
  fileFromLocal.size >= config.maxSizeUploadAvatar    // QUÁ LỚN (≥ 1MB)
  ||                                                  // HOẶC
  !fileFromLocal.type.includes('image')               // KHÔNG PHẢI ẢNH
)
```

| File chọn | `size >= 1MB` | `type.includes('image')` | Kết quả |
|-----------|:---:|:---:|---------|
| `photo.jpg` (500KB) | ❌ | ✅ | → Hợp lệ, `setFile(file)` |
| `photo.png` (2MB) | ✅ | ✅ | → Báo lỗi (quá lớn) |
| `doc.pdf` (100KB) | ❌ | ❌ | → Báo lỗi (không phải ảnh) |
| `video.mp4` (5MB) | ✅ | ❌ | → Báo lỗi (cả hai) |

### So sánh 2 cách kiểm tra định dạng:

#### Cách cũ — Whitelist (chặt):

```typescript
['image/jpeg', 'image/png'].includes(fileFromLocal.type)
// Chỉ cho JPEG và PNG. WebP, GIF, BMP... đều bị chặn.
```

#### Cách mới — Contains check (mở hơn):

```typescript
fileFromLocal.type.includes('image')
// Cho qua bất kỳ ảnh nào: image/jpeg, image/png, image/webp, image/gif...
```

**Tuy nhiên**, trong input HTML vẫn có:

```tsx
<input accept='.jpg,.jpeg,.png' />
```

→ Browser vẫn chỉ **hiện** file `.jpg/.jpeg/.png` trong hộp thoại chọn file. Nhưng `accept` chỉ là gợi ý UI, user vẫn có thể đổi filter sang "All Files" và chọn file khác → lúc đó JavaScript check sẽ chặn.

### Bỏ `setError` / `clearErrors` cho avatar:

| | Cách cũ | Cách mới |
|---|---|---|
| Sai ảnh | Toast + `setError('avatar')` → lỗi hiện DƯỚI ảnh + Toast hiện TRÊN | Chỉ Toast |
| Đúng ảnh | `clearErrors('avatar')` + `setValue('avatar')` | Chỉ `setFile(file)` |

**Trade-off:** Code ngắn hơn, nhưng user ít thông tin hơn (không có lỗi inline dưới field avatar). Trong trường hợp này, toast là đủ vì user sẽ thấy ngay.

### Thay đổi nhỏ: `>` thành `>=`

```diff
- fileFromLocal.size > 1024 * 1024         // Đúng 1MB: cho qua
+ fileFromLocal.size >= config.maxSizeUploadAvatar   // Đúng 1MB: cũng chặn
```

→ Quy tắc rõ ràng hơn: "tối đa 1MB" nghĩa là **dưới** 1MB, không phải "bằng 1MB cũng OK".

---

## 📁 3. Fix Bug: Chọn Lại Cùng 1 File Không Trigger `onChange`

Đây là 1 bug kinh điển của HTML input file.

### Bug gì?

```
Bước 1: User chọn "avatar.png" → onChange chạy → báo lỗi (ảnh quá lớn)
Bước 2: User resize ảnh, chọn lại "avatar.png" (cùng tên) → onChange KHÔNG chạy!
```

**Tại sao?** Browser so sánh value cũ và mới. Nếu cùng file name → browser nghĩ "không có thay đổi" → không bắn event `onChange`.

### Fix 1: Reset trước khi chọn (`onClick`)

```tsx
<input
  type='file'
  onClick={(event) => {
    ;(event.target as any).value = null     // ← Reset TRƯỚC khi mở hộp thoại
  }}
  onChange={onFileChange}
/>
```

**Cú pháp `;(event.target as any).value = null`:**

| Phần | Giải thích |
|------|-----------|
| `;` ở đầu | Đề phòng lỗi ASI (Automatic Semicolon Insertion) trong JavaScript |
| `(event.target as any)` | TypeScript cast — vì `event.target` không có property `value` theo type mặc định |
| `.value = null` | Xóa giá trị cũ của input |

**Luồng:**

```
User click input file
   ↓
onClick chạy → value = null (xóa file cũ)
   ↓
Browser mở hộp thoại chọn file
   ↓
User chọn "avatar.png" → browser so sánh: null ≠ "avatar.png" → CÓ thay đổi!
   ↓
onChange chạy → onFileChange xử lý file ✅
```

### Fix 2: Reset sau khi xử lý (`setAttribute`)

```typescript
const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const fileFromLocal = event.target.files?.[0]
  fileInputRef.current?.setAttribute('value', '')     // ← Reset SAU khi đọc file
  // ... xử lý validate ...
}
```

### Tại sao có 2 lần reset?

```
onClick: reset TRƯỚC → đảm bảo onChange luôn trigger
onFileChange: reset SAU → đảm bảo value sạch cho lần chọn tiếp theo
→ Double safety: không bao giờ bị "stuck" vì value cũ
```

> 💡 Hai cách reset input file:
> - `element.value = null` (DOM property)
> - `element.setAttribute('value', '')` (HTML attribute)
> 
> Cả hai đều hoạt động. Commit này dùng cả 2 ở 2 thời điểm khác nhau để an toàn tối đa.

---

## 📁 4. Toast Gom Thành 1 Message

### Trước — 2 toast riêng:

```typescript
toast.error('Định dạng ảnh không hợp lệ')      // Nếu sai type
toast.error('Dung lượng ảnh vượt quá 1 MB')     // Nếu sai size
```

### Sau — 1 toast chung:

```typescript
toast.error(`Dụng lượng file tối đa 1 MB. Định dạng:.JPEG, .PNG`, {
  position: 'top-center'
})
```

**Trade-off:**

| | 2 toast riêng | 1 toast chung |
|---|---|---|
| **Chính xác** | ✅ User biết lỗi gì cụ thể | ❌ Không rõ lỗi định dạng hay dung lượng |
| **Đơn giản** | ❌ Code dài hơn | ✅ Code ngắn, 1 message duy nhất |
| **UX** | Toast có thể chồng nhau | Sạch sẽ, 1 toast duy nhất |

Trong trường hợp này, 1 toast chung hiệu quả hơn vì user chỉ cần biết: "ảnh phải < 1MB và phải là JPEG/PNG".

---

## 🔗 So Sánh Trước/Sau

```
Commit 30c8fa5 (trước):                     Commit c28219c (sau):
┌─────────────────────────────┐             ┌─────────────────────────────┐
│ Validate:                   │             │ Validate:                   │
│ - 2 if riêng (type + size)  │     →       │ - 1 if gom (type + size)    │
│ - setError + clearErrors    │             │ - Chỉ toast                 │
│ - hard-code 1024*1024       │             │ - config.maxSizeUploadAvatar│
│                             │             │                             │
│ Bug:                        │             │ Fix:                        │
│ - Chọn lại cùng file       │     →       │ - onClick: value = null     │
│   → onChange không chạy     │             │ - setAttribute('value', '') │
└─────────────────────────────┘             └─────────────────────────────┘
```

---

## 🔗 Luồng Hoạt Động Sau Commit

```
1. User bấm "Chọn ảnh"
2. onClick → value = null (reset input để lần sau luôn trigger onChange)
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

## 📌 Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Magic Number → Named Constant** | Thay `1024 * 1024` bằng `config.maxSizeUploadAvatar` — dễ đọc, dễ bảo trì |
| **Input file reset trick** | `value = null` (onClick) + `setAttribute('value', '')` (onChange) — fix bug chọn lại cùng file |
| **`>` vs `>=`** | `> 1MB` cho phép đúng 1MB, `>= 1MB` chặn cả đúng 1MB. Chọn `>=` rõ ràng hơn |
| **MIME type check** | `file.type.includes('image')` mở hơn whitelist `['image/jpeg', 'image/png']` |
| **`accept` attribute** | Chỉ là gợi ý cho browser hiển thị file filter — **không** chặn thật sự |
| **ASI safe semicolon** | `;(expr)` — dấu `;` ở đầu tránh lỗi khi JS tự thêm semicolon sai chỗ |
| **Toast vs Inline Error** | Toast = thông báo nhanh, biến mất. Inline error = hiện dưới field, tồn tại lâu |
