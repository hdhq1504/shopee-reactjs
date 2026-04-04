# 30c8fa5 — feat: Thực hiện chức năng upload ảnh

## 🎯 Tổng Quan

Commit này hoàn thiện chức năng **upload ảnh đại diện** cho trang Profile. Có 4 ý chính:

1. Cho user chọn ảnh từ máy tính — sử dụng kỹ thuật **hidden input + ref.click()**.
2. Validate ảnh ngay ở phía frontend — kiểm tra định dạng & dung lượng trước khi upload.
3. Upload ảnh lên server rồi lưu tên ảnh vào profile — pattern **2-bước upload**.
4. Chuẩn hóa cách hiển thị avatar ở mọi nơi bằng hàm `getAvatarUrl`.

> 💡 Nếu commit `bd25411` đã làm được "cập nhật text profile", thì commit này đi tiếp "cập nhật luôn ảnh đại diện".

---

## 📁 Tổng Quan Các File Thay Đổi

| File | Loại thay đổi | Vai trò |
|------|---------------|---------|
| `src/pages/User/pages/Profile/Profile.tsx` | Sửa lớn | Thêm chọn ảnh, preview ảnh, upload ảnh, xử lý lỗi |
| `src/utils/utils.ts` | Sửa | Thêm hàm `getAvatarUrl` để tạo URL avatar đúng |
| `src/constants/config.ts` | Tạo mới | Chứa `baseUrl` dùng chung cho app |
| `src/utils/http.ts` | Sửa | Dùng `config.baseUrl` thay vì hard-code URL |
| `src/components/NavHeader/NavHeader.tsx` | Sửa | Dùng `getAvatarUrl(profile?.avatar)` |
| `src/pages/User/components/UserSideNav/UserSideNav.tsx` | Sửa | Dùng `getAvatarUrl(profile?.avatar)` |

---

## 📁 1. `Profile.tsx` — Kỹ Thuật Chọn Ảnh Bằng Hidden Input

### Thêm 2 hooks mới:

```typescript
const fileInputRef = useRef<HTMLInputElement>(null)
const [file, setFile] = useState<File>()
```

| Biến | Vai trò |
|------|---------|
| `fileInputRef` | Trỏ tới ô input file đang **bị ẩn** (`className='hidden'`) |
| `file` | Lưu File object mà user vừa chọn từ máy tính |

### Tại sao input file bị ẩn?

Input file mặc định của browser rất xấu: `[ Choose File ] No file chosen`. Shopee (và hầu hết web hiện đại) muốn nút bấm custom đẹp hơn.

**Cách hoạt động:**

```tsx
{/* Input ẩn — user không thấy */}
<input className='hidden' type='file' accept='.jpg,.jpeg,.png' ref={fileInputRef} onChange={onFileChange} />

{/* Nút đẹp — user thấy và bấm */}
<button type='button' onClick={handleUpload}>Chọn ảnh</button>
```

```typescript
const handleUpload = () => {
  fileInputRef.current?.click()    // ← Bấm nút → code tự click vào input ẩn
}
```

**Luồng:**

```
User bấm nút "Chọn ảnh" (nút đẹp)
   ↓
handleUpload() → fileInputRef.current.click()
   ↓
Browser "tưởng" user click input file → mở hộp thoại chọn file
   ↓
User chọn file → onChange trigger → onFileChange chạy
```

> 💡 **Pattern phổ biến:** Hidden input + ref click — dùng ở mọi nơi cần custom UI cho file input (upload ảnh, import CSV, đính kèm file...).

---

## 📁 2. `onFileChange` — Validate Ảnh Ở Frontend

```typescript
const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const fileFromLocal = event.target.files?.[0]    // Lấy file đầu tiên
  if (!fileFromLocal) return                       // Không chọn gì → bỏ qua

  // Rule 1: Chỉ cho ảnh JPEG hoặc PNG
  const isValidType = ['image/jpeg', 'image/png'].includes(fileFromLocal.type)
  if (!isValidType) {
    setError('avatar', { message: 'Chỉ chấp nhận ảnh JPEG hoặc PNG', type: 'Manual' })
    toast.error('Định dạng ảnh không hợp lệ')
    return
  }

  // Rule 2: Tối đa 1 MB
  if (fileFromLocal.size > 1024 * 1024) {
    setError('avatar', { message: 'Dung lượng ảnh tối đa là 1 MB', type: 'Manual' })
    toast.error('Dung lượng ảnh vượt quá 1 MB')
    return
  }

  // Hợp lệ → lưu file và clear lỗi cũ
  clearErrors('avatar')
  setValue('avatar', fileFromLocal.name, { shouldValidate: true, shouldDirty: true })
  setFile(fileFromLocal)
}
```

### 2 rule validate:

| Rule | Cách kiểm tra | Giá trị so sánh |
|------|---------------|-----------------|
| Định dạng | `fileFromLocal.type` | `'image/jpeg'` hoặc `'image/png'` |
| Dung lượng | `fileFromLocal.size` | `1024 * 1024` = 1.048.576 bytes = 1 MB |

### File object chứa gì?

Khi user chọn file "avatar.png" (500KB):

```typescript
fileFromLocal = {
  name: 'avatar.png',
  type: 'image/png',        // ← MIME type
  size: 512000,             // ← Bytes (500 KB)
  lastModified: 1711234567
}
```

### Tại sao validate ở frontend trước?

```
❌ Không validate frontend:
  User chọn file 50MB .pdf → gửi lên server → chờ 30 giây → server trả lỗi
  → Trải nghiệm tệ, tốn bandwidth

✅ Có validate frontend:
  User chọn file 50MB .pdf → frontend chặn ngay → báo lỗi trong 0.01 giây
  → Nhanh, không tốn request
```

---

## 📁 3. Preview Ảnh — `URL.createObjectURL()`

```typescript
const previewImage = useMemo(() => {
  return file ? URL.createObjectURL(file) : ''
}, [file])
```

```tsx
<img src={previewImage || getAvatarUrl(avatar)} alt='' />
```

### `URL.createObjectURL()` hoạt động thế nào?

Hàm này tạo một **URL tạm thời** trỏ đến file trên máy user — **không upload lên đâu cả**:

```
file = File { name: 'photo.jpg', size: 200000 }
   ↓
URL.createObjectURL(file)
   ↓
"blob:http://localhost:3000/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
   ↓
Trình duyệt dùng URL này để hiển thị ảnh từ bộ nhớ local
```

### Logic ưu tiên hiển thị:

```typescript
src={previewImage || getAvatarUrl(avatar)}
```

| Trường hợp | `previewImage` | Kết quả |
|-----------|----------------|---------|
| User vừa chọn ảnh mới | `"blob:..."` (truthy) | Hiện ảnh preview mới |
| Chưa chọn ảnh mới | `""` (falsy) | Hiện avatar cũ từ server |

> 💡 **`useMemo`** đảm bảo `URL.createObjectURL` chỉ chạy lại khi `file` thay đổi — tránh tạo URL tạm thừa.

---

## 📁 4. Upload Ảnh — Pattern 2 Bước

Khi submit, nếu có file mới → phải upload ảnh trước, rồi mới update profile:

```typescript
const onSubmit = handleSubmit(async (data) => {
  try {
    let avatarName = avatar                    // Giữ tên cũ mặc định

    // BƯỚC 1: Upload ảnh (nếu có chọn file mới)
    if (file) {
      const form = new FormData()              // ← Tạo FormData
      form.append('image', file)               // ← Key là 'image' (theo API)
      const uploadRes = await uploadAvatarMutation.mutateAsync(form)
      avatarName = uploadRes.data.data          // ← Server trả về tên file
      // Ví dụ: "abc123-avatar.png"

      if (!avatarName) {
        setError('avatar', { message: 'Upload ảnh thất bại...', type: 'Server' })
        return
      }
      setValue('avatar', avatarName)
    }

    // BƯỚC 2: Update profile với avatarName
    const res = await updateProfileMutation.mutateAsync({
      ...data,
      date_of_birth: data.date_of_birth?.toISOString(),
      avatar: avatarName                        // ← Tên file ảnh
    })

    setProfile(res.data.data)                   // Cập nhật Context
    setProfileToLS(res.data.data)               // Cập nhật localStorage
    refetch()                                   // Gọi lại getProfile
    toast.success(res.data.message)
  } catch (error) {
    // Xử lý lỗi...
  }
})
```

### Tại sao "2 bước" mà không gửi 1 lần?

```
❌ Gửi 1 lần (text + file chung):
  → Backend phải xử lý multipart phức tạp cho MỌI request update profile
  → Kể cả khi user chỉ đổi tên (không đổi ảnh) cũng phải gửi multipart

✅ Gửi 2 bước:
  Bước 1: POST /user/upload-avatar (multipart) → trả về tên file
  Bước 2: PUT /user (JSON) → gửi text + tên ảnh
  → Đơn giản hơn, tách biệt rõ ràng
```

### `FormData` là gì?

`FormData` là API browser dùng để gửi dữ liệu dạng **multipart/form-data** — format bắt buộc khi upload file:

```typescript
const form = new FormData()
form.append('image', file)
// → Request body sẽ gửi file dưới dạng binary, không phải JSON
```

Xem thêm ở `user.api.ts`:
```typescript
uploadAvatar(body: FormData) {
  return http.post<SuccessResponse<string>>('user/upload-avatar', body, {
    headers: {
      'Content-Type': 'multipart/form-data'     // ← Header bắt buộc
    }
  })
}
```

---

## 📁 5. Xử Lý Lỗi Upload

### Lỗi 422 (Unprocessable Entity) — Validation error từ server:

```typescript
if (isAxiosUnprocessableEntityError<ErrorResponse<FormDataError>>(error)) {
  const formError = error.response?.data.data
  if (formError) {
    Object.keys(formError).forEach((key) => {
      setError(key as keyof FormDataError, {
        message: formError[key as keyof FormDataError],
        type: 'Server'
      })
    })
  }
  return
}
```

**Logic:** Server trả object lỗi kiểu `{ name: "Tên quá dài", avatar: "Ảnh không hợp lệ" }` → duyệt qua từng key → `setError` lên form field tương ứng → UI hiện lỗi ngay dưới field đó.

### Lỗi khác (500, network error...):

```typescript
toast.error('Cập nhật hồ sơ thất bại. Vui lòng kiểm tra lại ảnh đại diện hoặc thử lại sau.')
```

---

## 📁 6. Hidden Input `avatar` — Gắn Vào Form

```tsx
<input type='hidden' {...register('avatar')} />
```

Field `avatar` không phải ô input user nhìn thấy, nhưng vẫn cần tham gia vào form để:

1. **Validate** — yup schema kiểm tra `avatar.max(1000)`
2. **Watch** — `const avatar = watch('avatar')` lấy giá trị hiện tại
3. **Set error** — `setError('avatar', {...})` gắn lỗi lên field này
4. **Submit** — giá trị `avatar` được gửi cùng form data

---

## 📁 7. `getAvatarUrl()` — Chuẩn Hóa URL Ảnh

```typescript
export const getAvatarUrl = (avatar?: string) => {
  if (!avatar) return userImage                      // TH1: Không có → ảnh mặc định
  if (/^https?:\/\//i.test(avatar)) return avatar    // TH2: Đã là URL đầy đủ → giữ nguyên
  return `${config.baseUrl}images/${avatar}`          // TH3: Chỉ là tên file → ghép URL
}
```

### 3 trường hợp:

| Input | Output | Ví dụ |
|-------|--------|-------|
| `undefined` / `""` | `user.svg` | User mới tạo, chưa có avatar |
| `"https://abc.com/img.jpg"` | Giữ nguyên | Avatar từ OAuth (Google, Facebook) |
| `"abc123-avatar.png"` | `"https://api-ecom.../images/abc123-avatar.png"` | Avatar upload qua app |

### Regex `^https?:\/\/` giải thích:

```
^        → bắt đầu chuỗi
http     → ký tự "http" literal
s?       → ký tự "s" (0 hoặc 1 lần) → match cả http và https
:\/\/    → ký tự "://" (escape dấu /)
/i       → case-insensitive
```

---

## 📁 8. `config.ts` — Tập Trung Cấu Hình

```typescript
const config = {
  baseUrl: 'https://api-ecom.duthanhduoc.com/'
}
export default config
```

Sau đó `http.ts` đổi từ hard-code:

```diff
- baseURL: 'https://api-ecom.duthanhduoc.com/'
+ baseURL: config.baseUrl
```

**Lợi ích:** Một nguồn sự thật duy nhất cho URL. Khi đổi server (dev → staging → prod), chỉ sửa 1 chỗ.

---

## 🔗 Luồng Hoạt Động Đầy Đủ

```
1. User mở /user/profile → avatar cũ hiển thị (qua getAvatarUrl)
2. User bấm "Chọn ảnh" → handleUpload() → fileInputRef.click()
3. Browser mở hộp thoại chọn file
4. User chọn "photo.jpg" (800 KB) → onFileChange:
   a) Kiểm tra type = image/jpeg ✅
   b) Kiểm tra size = 819200 < 1048576 ✅
   c) setFile(fileFromLocal) → lưu vào state
5. previewImage = URL.createObjectURL(file) → ảnh mới hiện ngay trên UI
6. User bấm [Lưu] → onSubmit:
   a) Upload ảnh: POST /user/upload-avatar → server trả "abc123.jpg"
   b) Update profile: PUT /user { ...data, avatar: "abc123.jpg" }
   c) Cập nhật Context + localStorage + refetch
7. NavHeader + SideNav + Profile đều hiện avatar mới qua getAvatarUrl("abc123.jpg")
8. Toast "Cập nhật thành công!" 🎉
```

---

## 📌 Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Hidden input + `ref.click()`** | Ẩn input file xấu, dùng nút đẹp + code click vào input ẩn |
| **`FormData` + `multipart/form-data`** | Kiểu gửi dữ liệu bắt buộc khi upload file lên server |
| **Client-side file validation** | Kiểm tra type/size ngay ở browser — nhanh, tiết kiệm bandwidth |
| **`URL.createObjectURL(file)`** | Tạo URL tạm từ file local để preview — không cần upload |
| **Pattern upload 2 bước** | Upload file trước → lấy tên → update profile sau — tách biệt multipart và JSON |
| **`getAvatarUrl()` normalize** | Hàm xử lý 3 trường hợp avatar: không có / URL đầy đủ / chỉ tên file |
| **`config.ts` centralize** | Gom cấu hình (baseUrl) vào 1 file — single source of truth |
