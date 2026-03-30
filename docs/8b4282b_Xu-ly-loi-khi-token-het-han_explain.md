# 8b4282b — feat: Xử lý lỗi khi token hết hạn

## 🎯 Tổng Quan

Khi access token hết hạn, server trả lỗi 401 → app cần **tự động xóa token + reset UI** về trạng thái chưa đăng nhập. Trước đây, việc xóa nằm rời rạc → giờ gom lại thành 1 luồng thống nhất sử dụng **Custom Event**.

## Vấn đề

```
1. User đăng nhập → nhận access_token → lưu vào localStorage
2. Dùng app bình thường trong 1 giờ...
3. Token hết hạn!
4. User bấm "Thêm vào giỏ" → API trả 401 Unauthorized
5. TRƯỚC ĐÂY:
   - http.ts gọi clearLS() → xóa localStorage      ✅
   - NHƯNG React state vẫn giữ isAuthenticated=true  ❌ ← BUG!
   - UI vẫn hiện avatar, nút đăng xuất, fetch giỏ hàng...
   - User phải F5 refresh thủ công mới reset được
```

## Giải pháp: Custom Event Pattern

```
SAU KHI SỬA:
1. Token hết hạn → API trả 401
2. http.ts: clearLS() → xóa localStorage + phát ra event 'clearLS'
3. App.tsx: đang lắng nghe event 'clearLS' → bắt được → gọi reset()
4. reset() → setIsAuthenticated(false), setProfile(null), setExtendedPurchases([])
5. UI tự động chuyển về trạng thái chưa đăng nhập ✅
```

---

## 📁 File 1: `src/utils/auth.ts` — Phát Event Khi Xóa Token

### Thay đổi:

```typescript
// MỚI: Tạo một "đài phát thanh" riêng
export const LocalStorageEventTarget = new EventTarget()

export const clearLS = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('profile')
  // MỚI: Phát đi tín hiệu 'clearLS' trên đài phát thanh
  const clearLSEvent = new Event('clearLS')
  LocalStorageEventTarget.dispatchEvent(clearLSEvent)
}
```

### Giải thích `EventTarget`:

**`EventTarget`** là API gốc của trình duyệt — cho phép tạo "đài radio" tùy chỉnh để phát/nhận tín hiệu:

```
EventTarget (Đài phát thanh)
    │
    ├── dispatchEvent('clearLS')    ← Phát tín hiệu
    │
    └── addEventListener('clearLS', callback)  ← Ai đăng ký nghe thì sẽ nhận được
```

| Khái niệm | So sánh thực tế |
|-----------|----------------|
| `new EventTarget()` | Mua 1 cục radio mới |
| `dispatchEvent(new Event('clearLS'))` | Phát sóng FM "Token đã bị xóa!" |
| `addEventListener('clearLS', fn)` | Bật radio lên, chỉnh đúng sóng FM để nghe |

### Tại sao KHÔNG dùng `window.addEventListener('storage')`?

Sự kiện `storage` của browser chỉ phát khi **tab khác** thay đổi localStorage, KHÔNG phát khi **tab hiện tại** thay đổi. Ta cần custom event để bắt được sự kiện ngay trên tab đang dùng.

---

## 📁 File 2: `src/contexts/app.context.tsx` — Thêm Hàm `reset()`

### Thay đổi:

```typescript
interface AppContextInterface {
  // ... các field cũ
  reset: () => void                    // ← MỚI
}

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  // ... các state cũ

  const reset = () => {                // ← MỚI
    setIsAuthenticated(false)
    setExtendedPurchases([])
    setProfile(null)
  }

  return (
    <AppContext.Provider
      value={{
        // ... các field cũ
        reset                          // ← MỚI
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
```

### Tại sao gom thành hàm `reset()` thay vì gọi 3 setter riêng lẻ?

- **Trước:** Ở `NavHeader` phải gọi `setIsAuthenticated(false)` + `setProfile(null)` riêng lẻ. Nếu sau này thêm state mới thì phải sửa ở nhiều chỗ.
- **Sau:** Chỉ cần gọi `reset()` ở bất kỳ đâu → đảm bảo **tất cả state** đều được dọn sạch.

---

## 📁 File 3: `src/utils/http.ts` — Xử lý lỗi 401

### Thay đổi trong response interceptor:

```typescript
this.instance.interceptors.response.use(
  (response) => { /* ... xử lý thành công ... */ },
  function (error: AxiosError) {
    // Hiện toast cho lỗi KHÔNG PHẢI 422 (validation)
    if (error.response?.status !== HttpStatusCode.UnprocessableEntity) {
      const data: any | undefined = error.response?.data
      const message = data.message || error.message
      toast.error(message)
    }
    // MỚI: Nếu lỗi là 401 (Unauthorized) → xóa token
    if (error.response?.status === HttpStatusCode.Unauthorized) {
      clearLS()    // ← Xóa localStorage + phát event 'clearLS'
    }
    return Promise.reject(error)
  }
)
```

### Luồng xử lý lỗi:

```
API trả lỗi
    │
    ├── 422 (Unprocessable Entity)?
    │   └── KHÔNG toast (để form component tự hiện lỗi validation)
    │
    ├── Các lỗi khác (400, 401, 403, 500...)?
    │   └── Toast thông báo lỗi cho user biết
    │
    └── 401 (Unauthorized) cụ thể?
        └── clearLS() → xóa token + phát event → App reset UI
```

> 💡 **Lưu ý:** Lỗi `401` vừa hiện toast VÀ xóa token. Hai block `if` chạy độc lập (không phải `else if`).

---

## 📁 File 4: `src/main.tsx` — Thay đổi cấu trúc `queryClient`

### Trước:

```typescript
import { queryClient } from '~/main'  // NavHeader import queryClient
```

### Sau:

```typescript
// main.tsx — queryClient KHÔNG export nữa
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 0
    }
  }
})
```

Trước đây `NavHeader` import `queryClient` trực tiếp từ `main.tsx` để gọi `removeQueries`. Giờ chuyển sang dùng `useQueryClient()` hook (cách chuẩn của React Query).

---

## 📁 File 5: `src/components/NavHeader/NavHeader.tsx` — Dùng `useQueryClient`

```typescript
// TRƯỚC:
import { queryClient } from '~/main'

// SAU:
import { useQueryClient } from '@tanstack/react-query'

export default function NavHeader() {
  const queryClient = useQueryClient()    // ← Lấy từ hook thay vì import trực tiếp
  // ...
}
```

**Tại sao đổi?**
- Import trực tiếp `queryClient` tạo **hard dependency** (phụ thuộc cứng) vào file `main.tsx` → khó test, khó refactor.
- `useQueryClient()` lấy từ React Context → **loose coupling** (liên kết lỏng), đúng cách React Query khuyên dùng.

---

## 📁 File 6: `src/App.tsx` — Lắng Nghe Event & Reset

```typescript
import { LocalStorageEventTarget } from '~/utils/auth'
import { useContext, useEffect } from 'react'
import { AppContext } from '~/contexts/app.context'

function App() {
  const routeElements = useRouteElements()
  const { reset } = useContext(AppContext)

  useEffect(() => {
    // Đăng ký lắng nghe event 'clearLS'
    LocalStorageEventTarget.addEventListener('clearLS', reset)
    return () => {
      // Cleanup khi App unmount
      LocalStorageEventTarget.removeEventListener('clearLS', reset)
    }
  }, [reset])

  return (
    <div>
      {routeElements}
      <ToastContainer />
    </div>
  )
}
```

### Tại sao đặt listener ở App?

`App` là component **gốc**, luôn tồn tại khi ứng dụng đang chạy → đảm bảo listener luôn hoạt động, bất kể user đang ở trang nào.

---

## 🔗 Luồng Hoạt Động Đầy Đủ (Token Hết Hạn)

```
1. User đăng nhập vào app (token lưu LS + state = authenticated)
       │
2. Sau 1 giờ, token hết hạn
       │
3. User bấm "Thêm vào giỏ"
       │
       ▼
4. http.ts gửi request → Server trả 401 Unauthorized
       │
       ▼
5. Response interceptor bắt lỗi 401:
   a) toast.error("Token hết hạn")          → USER thấy thông báo lỗi
   b) clearLS()                              → Xóa access_token + profile từ localStorage
   c) LocalStorageEventTarget.dispatchEvent() → Phát event 'clearLS'
       │
       ▼
6. App.tsx đang lắng nghe event 'clearLS' → Bắt được!
       │
       ▼
7. Gọi reset():
   - setIsAuthenticated(false)   → ProtectedRoute redirect về /login
   - setProfile(null)            → NavHeader ẩn avatar
   - setExtendedPurchases([])    → Giỏ hàng xóa sạch
       │
       ▼
8. UI tự động chuyển về trang Login ✅ (không cần F5)
```

---

## 📌 Kiến Thức Mới Tổng Hợp

| Khái niệm | Giải thích |
|-----------|-----------|
| **`EventTarget` / Custom Event** | API browser cho phép tạo hệ thống pub/sub tùy chỉnh — phát/nhận tín hiệu giữa các module không liên quan nhau |
| **`useQueryClient()` vs import** | Hook lấy queryClient từ React Context — loose coupling, dễ test, đúng best practice |
| **`reset()` pattern** | Gom tất cả logic "dọn dẹp" vào 1 hàm duy nhất — tránh thiếu sót khi reset state |
| **401 Auto-logout** | Khi server trả Unauthorized → tự động xóa token + reset UI → redirect về login |
