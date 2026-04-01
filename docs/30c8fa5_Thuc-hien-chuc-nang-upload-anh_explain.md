# 30c8fa5 — feat: Thực hiện chức năng upload ảnh

## 🎯 Tổng Quan

Commit này hoàn thiện chức năng **upload ảnh đại diện** cho trang `Profile`. Có 4 ý chính:

1. Cho user chọn ảnh từ máy tính.
2. Validate ảnh ngay ở phía frontend trước khi upload.
3. Upload ảnh lên server rồi lưu tên ảnh vào profile.
4. Chuẩn hóa cách hiển thị avatar ở nhiều nơi bằng hàm `getAvatarUrl`.

> 💡 Nếu commit `bd25411` đã làm được bước “cập nhật text profile”, thì commit này đi tiếp bước “cập nhật luôn ảnh đại diện”.

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

## 📁 1. `Profile.tsx` — Thêm Chức Năng Chọn Ảnh Từ Máy

Commit này thêm các hook:

```ts
const fileInputRef = useRef<HTMLInputElement>(null)
const [file, setFile] = useState<File>()
```

### Ý nghĩa

| Biến | Vai trò |
|------|--------|
| `fileInputRef` | Trỏ tới ô input file đang bị ẩn |
| `file` | Lưu file ảnh user vừa chọn |

### Tại sao input file lại bị ẩn?

Trong UI, tác giả không muốn hiện ô input file mặc định của trình duyệt, nên để:

```tsx
<input className='hidden' type='file' ... />
```

Sau đó dùng nút:

```tsx
<button type='button' onClick={handleUpload}>
  Chọn ảnh
</button>
```

Khi bấm nút này, code sẽ gọi:

```ts
const handleUpload = () => {
  fileInputRef.current?.click()
}
```

### Hiểu đơn giản

```text
User bấm nút "Chọn ảnh"
   ↓
Code tự click vào input file bị ẩn
   ↓
Trình duyệt mở hộp thoại chọn file
```

Cách làm này giúp giao diện đẹp hơn mà vẫn dùng được cơ chế chọn file của browser.

---

## 📁 2. `onFileChange` — Validate Ảnh Ngay Ở Frontend

Đây là đoạn rất quan trọng:

```ts
const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const fileFromLocal = event.target.files?.[0]
  if (!fileFromLocal) return

  const isValidType = ['image/jpeg', 'image/png'].includes(fileFromLocal.type)
  if (!isValidType) {
    ...
    return
  }

  if (fileFromLocal.size > 1024 * 1024) {
    ...
    return
  }

  clearErrors('avatar')
  setValue('avatar', fileFromLocal.name, { shouldValidate: true, shouldDirty: true })
  setFile(fileFromLocal)
}
```

### Có 2 rule validate chính:

#### 1. Chỉ cho chọn `.jpeg` hoặc `.png`

```ts
const isValidType = ['image/jpeg', 'image/png'].includes(fileFromLocal.type)
```

Nếu sai định dạng:

- xóa file đang chọn
- báo lỗi cho field `avatar`
- hiện toast lỗi

#### 2. Dung lượng tối đa 1 MB

```ts
if (fileFromLocal.size > 1024 * 1024)
```

Nếu file quá lớn:

- không cho upload tiếp
- báo lỗi ngay cho user

### Tại sao nên validate ở frontend trước?

Vì nếu ảnh sai ngay từ đầu mà vẫn gửi lên server thì:

1. Tốn request không cần thiết
2. User phải chờ lâu hơn
3. Trải nghiệm không tốt

### Luồng chạy

```text
User chọn file
   ↓
Frontend kiểm tra định dạng
   ↓
Frontend kiểm tra dung lượng
   ↓
Nếu hợp lệ thì lưu file vào state
   ↓
Nếu không hợp lệ thì báo lỗi ngay
```

---

## 📁 3. Preview Ảnh Trước Khi Lưu

Commit này thêm:

```ts
const previewImage = useMemo(() => {
  return file ? URL.createObjectURL(file) : ''
}, [file])
```

Và dùng ở UI:

```tsx
<img
  src={previewImage || getAvatarUrl(avatar)}
  alt=''
  className='h-full w-full rounded-full object-cover'
/>
```

### Ý nghĩa

Nếu user vừa chọn một file mới:

- ưu tiên hiện ảnh preview từ file local

Nếu chưa chọn file mới:

- hiện avatar cũ từ profile

### Nhờ đó user sẽ thấy gì?

```text
User chọn ảnh mới
   ↓
Ảnh mới hiện ngay trên giao diện
   ↓
User biết chắc mình đã chọn đúng ảnh
```

Đây là một cải thiện UX rất tốt.

---

## 📁 4. Upload Ảnh Thật Khi Submit Form

Phần submit giờ không chỉ update text profile nữa, mà còn upload ảnh nếu có file mới.

```ts
const onSubmit = handleSubmit(async (data) => {
  try {
    let avatarName = avatar
    if (file) {
      const form = new FormData()
      form.append('image', file)
      const uploadRes = await uploadAvatarMutation.mutateAsync(form)
      avatarName = uploadRes.data.data
      ...
      setValue('avatar', avatarName, { shouldValidate: true, shouldDirty: true })
    }
    const res = await updateProfileMutation.mutateAsync({
      ...data,
      date_of_birth: data.date_of_birth?.toISOString(),
      avatar: avatarName
    })
    ...
  } catch (error) {
    ...
  }
})
```

### Bước 1. Nếu có file mới thì upload ảnh trước

```ts
if (file) {
  const form = new FormData()
  form.append('image', file)
  const uploadRes = await uploadAvatarMutation.mutateAsync(form)
}
```

Lưu ý:

- API upload ảnh cần `FormData`
- key gửi lên là `image`

### Bước 2. Lấy tên ảnh server trả về

```ts
avatarName = uploadRes.data.data
```

Server không nhất thiết trả về cả URL đầy đủ, mà có thể chỉ trả về tên file.

Ví dụ:

```text
abc123-avatar.png
```

### Bước 3. Gửi tiếp request update profile

Sau khi có `avatarName`, request update profile sẽ gửi:

- name
- phone
- address
- date_of_birth
- avatar

### Luồng đầy đủ

```text
User chọn ảnh mới
   ↓
User bấm Lưu
   ↓
Frontend upload ảnh lên server trước
   ↓
Server trả về tên ảnh
   ↓
Frontend dùng tên ảnh đó để gọi API update profile
   ↓
Profile mới được lưu hoàn chỉnh
```

Đây là pattern rất phổ biến khi làm upload avatar.

---

## 📁 5. Xử Lý Lỗi Upload Và Lỗi Server

Commit này xử lý lỗi khá kỹ.

### 5.1. Nếu upload xong nhưng không nhận được tên ảnh

```ts
if (!avatarName) {
  setError('avatar', {
    message: 'Upload ảnh thất bại, vui lòng chọn lại ảnh khác',
    type: 'Server'
  })
  return
}
```

### 5.2. Nếu server trả lỗi 422

```ts
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

### Ý nghĩa

Nếu backend trả lỗi validate, ví dụ:

- ảnh sai
- field nào đó không hợp lệ

thì frontend sẽ gán lỗi đúng vào từng field của form.

### 5.3. Nếu là lỗi khác

```ts
toast.error('Cập nhật hồ sơ thất bại. Vui lòng kiểm tra lại ảnh đại diện hoặc thử lại sau.')
```

User vẫn nhận được thông báo rõ ràng thay vì app im lặng.

---

## 📁 6. Hidden Input `avatar` — Để Avatar Tham Gia Vào Form

Commit này thêm:

```tsx
<input type='hidden' {...register('avatar')} />
```

### Tại sao cần input ẩn này?

Field `avatar` không phải là ô input text user nhìn thấy trực tiếp, nhưng nó vẫn là một phần của form data.

Nên tác giả đăng ký nó với `react-hook-form` bằng input ẩn để:

1. Field `avatar` được quản lý trong form
2. Có thể validate và set lỗi cho field này
3. Có thể dùng `watch('avatar')`

---

## 📁 7. `getAvatarUrl` — Chuẩn Hóa Cách Tạo URL Ảnh

Commit này thêm hàm mới trong `src/utils/utils.ts`:

```ts
export const getAvatarUrl = (avatar?: string) => {
  if (!avatar) return userImage
  if (/^https?:\/\//i.test(avatar)) return avatar
  return `${config.baseUrl}images/${avatar}`
}
```

### Hàm này giải quyết vấn đề gì?

Dữ liệu `avatar` có thể ở 3 dạng:

1. Không có avatar
2. Avatar đã là URL đầy đủ
3. Avatar chỉ là tên file do server trả về

### Hàm xử lý từng trường hợp:

#### Trường hợp 1. Không có avatar

```ts
if (!avatar) return userImage
```

Trả về ảnh mặc định.

#### Trường hợp 2. Đã là URL đầy đủ

```ts
if (/^https?:\/\//i.test(avatar)) return avatar
```

Giữ nguyên URL đó.

#### Trường hợp 3. Chỉ là tên file

```ts
return `${config.baseUrl}images/${avatar}`
```

Ghép thành URL hoàn chỉnh.

### Ví dụ

```text
avatar = undefined
→ trả về user.svg

avatar = https://abc.com/avatar.png
→ trả về chính URL đó

avatar = 12345-avatar.png
→ trả về https://api-ecom.duthanhduoc.com/images/12345-avatar.png
```

---

## 📁 8. `config.ts` Và `http.ts` — Đưa `baseUrl` Ra Cấu Hình Chung

Commit này tạo file:

```ts
const config = {
  baseUrl: 'https://api-ecom.duthanhduoc.com/'
}
```

Sau đó `http.ts` đổi từ:

```ts
baseURL: 'https://api-ecom.duthanhduoc.com/'
```

thành:

```ts
baseURL: config.baseUrl
```

### Lợi ích

Thay vì hard-code URL API ở nhiều nơi, giờ app dùng chung một cấu hình.

Điều này giúp:

1. Dễ sửa khi đổi server
2. Tránh lặp lại chuỗi URL
3. `getAvatarUrl` và `http.ts` cùng dùng chung một nguồn `baseUrl`

---

## 📁 9. `NavHeader.tsx` Và `UserSideNav.tsx` — Dùng Chung `getAvatarUrl`

Trước đây các file này tự xử lý avatar theo kiểu riêng.

Sau commit:

```tsx
<img src={getAvatarUrl(profile?.avatar)} ... />
```

### Ý nghĩa

Giờ cả:

- header
- user sidebar
- profile preview

đều dùng chung một logic tạo URL avatar.

Nhờ vậy:

1. Code đồng nhất hơn
2. Ít lặp code hơn
3. Tránh bug chỗ hiển thị được ảnh, chỗ khác lại không

---

## 🔗 Luồng Hoạt Động Sau Commit

```text
1. User mở trang /user/profile
2. User bấm "Chọn ảnh"
3. Trình duyệt mở cửa sổ chọn file
4. Frontend kiểm tra định dạng và dung lượng ảnh
5. Nếu hợp lệ, ảnh được preview ngay trên giao diện
6. User bấm "Lưu"
7. Frontend upload ảnh lên server trước
8. Server trả về tên ảnh
9. Frontend gọi API update profile kèm avatar mới
10. Header, sidebar và profile đều hiển thị avatar mới
```

Commit này giúp phần Profile đi từ mức “cập nhật text profile” sang mức “cập nhật đầy đủ cả ảnh đại diện”.

---

## 📌 Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **`useRef` với input file** | Dùng để click vào input file bị ẩn bằng code |
| **`FormData`** | Kiểu dữ liệu dùng để gửi file lên server |
| **Client-side validation** | Kiểm tra file ngay trên frontend trước khi gửi lên backend |
| **Preview image** | Hiển thị ảnh vừa chọn ngay trên giao diện trước khi lưu |
| **`URL.createObjectURL()`** | Tạo URL tạm từ file local để preview |
| **Fallback / normalize avatar URL** | Chuẩn hóa cách lấy URL ảnh cho mọi trường hợp: không có ảnh, URL đầy đủ, hoặc chỉ có tên file |
