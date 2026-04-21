# 30c8fa5 — feat: Thực hiện chức năng upload ảnh

## Tổng Quan

Commit này hoàn thiện chức năng **upload ảnh đại diện** cho trang Profile. Có 4 ý chính:

1. Cho user chọn ảnh từ máy tính — kỹ thuật **hidden input + ref click** để thay thế UI xấu của browser.
2. Validate ảnh ngay ở frontend — kiểm tra định dạng và dung lượng trước khi upload.
3. Upload ảnh lên server rồi lưu tên ảnh vào profile — pattern **2 bước**.
4. Chuẩn hóa cách hiển thị avatar ở mọi nơi bằng hàm `getAvatarUrl`.

---

## Các File Thay Đổi

| File | Loại thay đổi | Vai trò |
|------|---------------|---------|
| `src/pages/User/pages/Profile/Profile.tsx` | Sửa lớn | Thêm chọn ảnh, preview ảnh, upload ảnh, xử lý lỗi |
| `src/utils/utils.ts` | Sửa | Thêm hàm `getAvatarUrl` để tạo URL avatar đúng |
| `src/constants/config.ts` | Tạo mới | Chứa `baseUrl` dùng chung cho toàn app |
| `src/utils/http.ts` | Sửa | Dùng `config.baseUrl` thay vì hard-code URL |
| `src/components/NavHeader/NavHeader.tsx` | Sửa | Dùng `getAvatarUrl(profile?.avatar)` |
| `src/pages/User/components/UserSideNav/UserSideNav.tsx` | Sửa | Dùng `getAvatarUrl(profile?.avatar)` |

---

## 1. `Profile.tsx` — Kỹ Thuật Chọn Ảnh Bằng Hidden Input

### Thêm 2 hooks mới:

```typescript
const fileInputRef = useRef<HTMLInputElement>(null)
const [file, setFile] = useState<File>()
```

| Biến | Vai trò |
|------|---------|
| `fileInputRef` | Trỏ tới ô input file (đang bị ẩn đi bằng `className='hidden'`) |
| `file` | Lưu File object mà user vừa chọn — dùng để preview và upload |

### Tại sao input file bị ẩn?

Input file mặc định của browser trông rất xấu và không thể tùy chỉnh CSS thoải mái:

```
Mặc định: [ Choose File ] No file chosen
Shopee muốn: Một nút tròn đẹp với icon camera
```

Giải pháp phổ biến — **Hidden Input + Custom Button**:

```tsx
{/* Input ẩn — user không thấy, trình duyệt vẫn dùng để mở hộp thoại */}
<input className='hidden' type='file' accept='.jpg,.jpeg,.png' ref={fileInputRef} onChange={onFileChange} />

{/* Nút đẹp — user thấy và bấm */}
<button type='button' onClick={handleUpload}>Chọn ảnh</button>
```

```typescript
const handleUpload = () => {
  fileInputRef.current?.click()   // Code "giả vờ" click vào input ẩn
}
```

Luồng hoạt động:
```
User bấm nút "Chọn ảnh" (nút đẹp)
    ↓
handleUpload() chạy → fileInputRef.current.click()
    ↓
Browser "nghĩ" user đã click vào input file → mở hộp thoại chọn file
    ↓
User chọn file → onChange trigger → onFileChange chạy
```

Đây là pattern rất phổ biến — dùng ở mọi nơi cần custom UI cho file input: upload ảnh, import CSV, đính kèm file...

---

## 2. `onFileChange` — Validate Ảnh Ở Frontend

```typescript
const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const fileFromLocal = event.target.files?.[0]   // Lấy file đầu tiên trong danh sách
  if (!fileFromLocal) return                       // User không chọn gì → bỏ qua

  // Kiểm tra 1: Chỉ cho ảnh JPEG hoặc PNG
  const isValidType = ['image/jpeg', 'image/png'].includes(fileFromLocal.type)
  if (!isValidType) {
    setError('avatar', { message: 'Chỉ chấp nhận ảnh JPEG hoặc PNG', type: 'Manual' })
    toast.error('Định dạng ảnh không hợp lệ')
    return
  }

  // Kiểm tra 2: Tối đa 1 MB
  if (fileFromLocal.size > 1024 * 1024) {
    setError('avatar', { message: 'Dung lượng ảnh tối đa là 1 MB', type: 'Manual' })
    toast.error('Dung lượng ảnh vượt quá 1 MB')
    return
  }

  // Hợp lệ → lưu file vào state và xóa lỗi cũ
  clearErrors('avatar')
  setValue('avatar', fileFromLocal.name, { shouldValidate: true, shouldDirty: true })
  setFile(fileFromLocal)
}
```

### 2 quy tắc validate:

| Quy tắc | Cách kiểm tra | Giá trị so sánh |
|---------|---------------|----------------|
| Định dạng | `fileFromLocal.type` | `'image/jpeg'` hoặc `'image/png'` |
| Dung lượng | `fileFromLocal.size` | `1024 * 1024` = 1.048.576 bytes = 1 MB |

### File object chứa gì?

Khi user chọn file "avatar.png" (500KB), `event.target.files[0]` là:

```typescript
{
  name: 'avatar.png',
  type: 'image/png',        // MIME type — trình duyệt tự xác định
  size: 512000,             // Kích thước tính bằng bytes (500 KB × 1024 = 512.000)
  lastModified: 1711234567  // Timestamp
}
```

### Tại sao validate ở frontend trước?

```
Không có validate frontend:
  User chọn file 50MB .pdf → gửi lên server → chờ upload 30 giây → server trả lỗi
  → Trải nghiệm tệ, tốn bandwidth, người dùng bực bội

Có validate frontend:
  User chọn file 50MB .pdf → frontend chặn ngay → báo lỗi trong 0.01 giây
  → Nhanh, không tốn request, người dùng biết ngay phải làm gì
```

Frontend validate là **lớp bảo vệ đầu tiên** — nhanh, thân thiện với user. Backend vẫn phải validate lại vì frontend có thể bị bypass.

---

## 3. Preview Ảnh — `URL.createObjectURL()`

```typescript
const previewImage = useMemo(() => {
  return file ? URL.createObjectURL(file) : ''
}, [file])
```

```tsx
<img src={previewImage || getAvatarUrl(avatar)} alt='' />
```

### `URL.createObjectURL()` hoạt động thế nào?

Hàm này tạo một **URL tạm thời** trỏ đến file trong bộ nhớ máy tính của user — **không upload gì lên server cả**:

```
file = File { name: 'photo.jpg', size: 200000 }
    ↓
URL.createObjectURL(file)
    ↓
"blob:http://localhost:3000/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    ↓
Trình duyệt dùng URL này để hiển thị ảnh từ bộ nhớ local ngay lập tức
```

Nhờ vậy user thấy ảnh preview ngay khi chọn, mà không cần đợi upload lên server xong.

### Logic ưu tiên hiển thị:

```typescript
src={previewImage || getAvatarUrl(avatar)}
```

| Trường hợp | `previewImage` | Kết quả hiển thị |
|-----------|----------------|-----------------|
| User vừa chọn ảnh mới | `"blob:..."` (truthy) | Ảnh preview mới chưa upload |
| Chưa chọn ảnh mới | `""` (falsy) | Avatar cũ từ server |

`useMemo` đảm bảo `URL.createObjectURL` chỉ chạy lại khi `file` thay đổi — không tạo URL blob thừa mỗi lần re-render.

---

## 4. Upload Ảnh — Pattern 2 Bước

Khi submit, nếu có file mới → upload ảnh trước, lấy tên file, rồi mới update profile:

```typescript
const onSubmit = handleSubmit(async (data) => {
  try {
    let avatarName = avatar   // Giữ tên avatar cũ làm mặc định

    // BƯỚC 1: Upload ảnh (chỉ khi user có chọn file mới)
    if (file) {
      const form = new FormData()     // Tạo FormData để gửi file
      form.append('image', file)      // Key 'image' theo convention của API
      const uploadRes = await uploadAvatarMutation.mutateAsync(form)
      avatarName = uploadRes.data.data  // Server trả về tên file đã lưu
      // Ví dụ: "abc123-1710000000000.jpg"

      if (!avatarName) {
        setError('avatar', { message: 'Upload ảnh thất bại...', type: 'Server' })
        return
      }
      setValue('avatar', avatarName)
    }

    // BƯỚC 2: Update profile với avatarName (tên file trên server)
    const res = await updateProfileMutation.mutateAsync({
      ...data,
      date_of_birth: data.date_of_birth?.toISOString(),
      avatar: avatarName    // Chỉ gửi tên file, không gửi cả file binary lên đây
    })

    setProfile(res.data.data)      // Cập nhật Context
    setProfileToLS(res.data.data)  // Cập nhật localStorage
    refetch()                      // Đồng bộ với server
    toast.success(res.data.message)
  } catch (error) {
    // Xử lý lỗi...
  }
})
```

### Tại sao cần 2 bước mà không gửi tất cả 1 lần?

**Gửi một lần (file + profile data chung):**
- Backend phải xử lý `multipart/form-data` cho mọi request update profile — kể cả khi user chỉ đổi tên (không đổi ảnh)
- Code phức tạp hơn ở cả frontend lẫn backend
- Nếu update profile fail sau khi upload ảnh → ảnh đã upload bị "mồ côi"

**Gửi 2 bước:**
```
Bước 1: POST /user/upload-avatar (multipart) → Server lưu ảnh → Trả về tên file
Bước 2: PUT /user (JSON) → Gửi text + tên file (không gửi binary)
→ Đơn giản, tách biệt rõ ràng
→ Endpoint upload avatar có thể tái sử dụng ở nhiều nơi
```

### `FormData` là gì?

`FormData` là API browser dùng để đóng gói dữ liệu theo định dạng `multipart/form-data` — định dạng bắt buộc khi upload file (không dùng JSON được vì JSON không chứa binary data):

```typescript
const form = new FormData()
form.append('image', file)   // 'image' là tên field, file là binary data
// → Request body: multipart binary, không phải JSON
```

Trong `user.api.ts`:
```typescript
uploadAvatar(body: FormData) {
  return http.post<SuccessResponse<string>>('user/upload-avatar', body, {
    headers: {
      'Content-Type': 'multipart/form-data'   // Header bắt buộc
    }
  })
}
```

---

## 5. Xử Lý Lỗi Upload

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

Server trả object lỗi dạng `{ avatar: "Ảnh không hợp lệ", name: "Tên quá dài" }` → duyệt qua từng key → gọi `setError()` để lỗi hiện ngay dưới field tương ứng trong form.

### Lỗi khác (500, network error...):

```typescript
toast.error('Cập nhật hồ sơ thất bại. Vui lòng kiểm tra lại ảnh hoặc thử lại sau.')
```

---

## 6. Hidden Input `avatar` — Gắn Vào Form

```tsx
<input type='hidden' {...register('avatar')} />
```

Field `avatar` không cần hiển thị cho user, nhưng vẫn cần tham gia form để:

1. **Validate** — Yup schema kiểm tra `avatar.max(1000)` (độ dài tên file)
2. **Watch** — `const avatar = watch('avatar')` lấy giá trị tên avatar hiện tại
3. **Set error** — `setError('avatar', {...})` gắn lỗi lên field này
4. **Submit** — giá trị `avatar` được gửi cùng form data

---

## 7. `getAvatarUrl()` — Chuẩn Hóa URL Ảnh

```typescript
export const getAvatarUrl = (avatar?: string) => {
  if (!avatar) return userImage                        // Không có avatar → ảnh mặc định
  if (/^https?:\/\//i.test(avatar)) return avatar     // Đã là URL đầy đủ → giữ nguyên
  return `${config.baseUrl}images/${avatar}`           // Chỉ là tên file → ghép thành URL hoàn chỉnh
}
```

### 3 trường hợp:

| Input | Output | Ví dụ |
|-------|--------|-------|
| `undefined` hoặc `""` | `user.svg` (ảnh mặc định) | User mới tạo tài khoản, chưa có avatar |
| `"https://abc.com/img.jpg"` | Giữ nguyên URL | Avatar từ OAuth (Google, Facebook) |
| `"abc123.jpg"` | `"https://api.../images/abc123.jpg"` | Avatar upload qua app |

### Giải thích Regex `^https?:\/\/`:

```
^        → bắt đầu chuỗi (không phải https ở giữa)
http     → ký tự "http" literal
s?       → ký tự "s" (0 hoặc 1 lần) → match cả http và https
:\/\/    → ký tự "://" (phải escape dấu / trong regex)
/i       → case-insensitive (match cả HTTP:// lẫn https://)
```

Hàm này cần thiết vì avatar có thể đến từ nhiều nguồn khác nhau (upload trực tiếp, OAuth, legacy data...) với format khác nhau. Thay vì xử lý ở mỗi component, tập trung logic vào `getAvatarUrl()`.

---

## 8. `config.ts` — Tập Trung Cấu Hình Base URL

```typescript
const config = {
  baseUrl: 'https://api-ecom.duthanhduoc.com/'
}
export default config
```

Sau đó `http.ts` đổi từ hardcode sang dùng config:

```diff
- baseURL: 'https://api-ecom.duthanhduoc.com/'
+ baseURL: config.baseUrl
```

**Tại sao cần?** Khi deploy lên môi trường khác (staging, production), chỉ cần sửa `config.ts` ở một chỗ — không phải tìm và sửa ở nhiều file. Đây là nguyên tắc **Single Source of Truth** (một nguồn sự thật duy nhất).

---

## Luồng Hoạt Động Đầy Đủ

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
8. Toast "Cập nhật thành công!"
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Hidden input + `ref.click()`** | Ẩn input file mặc định của browser (trông xấu), dùng nút custom + code trigger click vào input ẩn để mở hộp thoại chọn file. |
| **`FormData` + `multipart/form-data`** | Kiểu gửi dữ liệu bắt buộc khi upload file. Không dùng JSON vì JSON không chứa được binary data. |
| **Client-side file validation** | Kiểm tra type và size của file ngay ở browser trước khi gửi lên server. Nhanh, tiết kiệm bandwidth, trải nghiệm tốt hơn. |
| **`URL.createObjectURL(file)`** | Tạo URL tạm từ file trong bộ nhớ local để preview — không cần upload. URL chỉ tồn tại trong phiên làm việc hiện tại. |
| **Pattern upload 2 bước** | Upload file trước (nhận tên file) → update data sau (gửi tên file). Giúp tách biệt `multipart` và `JSON`, endpoint upload có thể tái sử dụng. |
| **`getAvatarUrl()` normalize** | Hàm chuẩn hóa avatar URL xử lý 3 trường hợp: không có / URL đầy đủ / chỉ tên file. Đặt logic ở một chỗ thay vì xử lý rải rác ở nhiều component. |
| **`config.ts` centralize** | Gom cấu hình (baseUrl) vào một file duy nhất. Khi đổi môi trường, chỉ sửa một chỗ. |
