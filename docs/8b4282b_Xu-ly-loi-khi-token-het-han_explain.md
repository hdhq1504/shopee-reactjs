# 8b4282b — feat: Xử lý lỗi khi token hết hạn

## Tổng Quan

Khi access token hết hạn, server trả lỗi 401 → app cần **tự động xóa token + reset UI** về trạng thái chưa đăng nhập. Commit này gom toàn bộ luồng này lại thành một hệ thống thống nhất sử dụng **Custom Event** để kết nối hai module không liên quan nhau (`http.ts` và `App.tsx`).

---

## Vấn Đề Cần Giải Quyết

```
1. User đăng nhập → nhận access_token → lưu vào localStorage
2. Dùng app bình thường trong 1 giờ...
3. Token hết hạn!
4. User bấm "Thêm vào giỏ" → API trả 401 Unauthorized

TRƯỚC ĐÂY (có bug):
   - http.ts gọi clearLS() → xóa localStorage          ✅
   - NHƯNG React state vẫn giữ isAuthenticated=true     ❌  ← BUG!
   - UI vẫn hiện avatar, nút đăng xuất, gọi API giỏ hàng...
   - User phải F5 refresh thủ công mới reset được
```

**Nguyên nhân:** `http.ts` và `App.tsx` là 2 module riêng biệt. `http.ts` chỉ có thể xóa localStorage (dữ liệu persistent), nhưng không thể trực tiếp gọi hàm `setIsAuthenticated(false)` trong React component (React state). Cần cơ chế để chúng "nói chuyện" với nhau.

---

## Giải Pháp: Custom Event Pattern

**Custom Event** là cơ chế pub/sub (publish-subscribe) dùng API sẵn có của browser:

- Module A "phát" sự kiện (publish/dispatch)
- Module B "lắng nghe" sự kiện (subscribe/addEventListener)
- Hai module không cần biết nhau, chỉ cần đồng ý về tên sự kiện

```
Luồng sau khi sửa:

Token hết hạn → 401
    ↓
http.ts: clearLS() → xóa localStorage + phát event 'clearLS'
    ↓
App.tsx: đang lắng nghe event 'clearLS' → bắt được → gọi reset()
    ↓
reset() → setIsAuthenticated(false), setProfile(null), setExtendedPurchases([])
    ↓
UI tự động chuyển về trạng thái chưa đăng nhập ✅ (không cần F5)
```

---

## File 1: `src/utils/auth.ts` — Phát Event Khi Xóa Token

```typescript
// Tạo một "đài phát thanh" tùy chỉnh — đây là object EventTarget của browser
export const LocalStorageEventTarget = new EventTarget()

export const clearLS = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('profile')

  // Tạo sự kiện có tên 'clearLS'
  const clearLSEvent = new Event('clearLS')
  // Phát sự kiện trên "đài phát thanh"
  LocalStorageEventTarget.dispatchEvent(clearLSEvent)
}
```

### `EventTarget` là gì?

`EventTarget` là API gốc của browser — cùng cơ chế mà `document` và `window` dùng để nhận sự kiện click, keypress, resize... Ở đây ta tạo một EventTarget tùy chỉnh để không "bẩn" các event của browser.

| Khái niệm | So sánh |
|-----------|---------|
| `new EventTarget()` | Mua 1 cục radio mới |
| `dispatchEvent(new Event('clearLS'))` | Phát sóng FM "Token đã bị xóa!" |
| `addEventListener('clearLS', fn)` | Bật radio, chỉnh đúng sóng FM đó để nghe |

### Tại sao không dùng `window.addEventListener('storage')`?

Sự kiện `storage` của browser chỉ phát khi **tab KHÁC** thay đổi localStorage — không phát khi **tab hiện tại** thay đổi. Đây là thiết kế của browser để đồng bộ giữa các tab. Ta cần custom event để bắt được sự kiện ngay trên tab đang dùng.

---

## File 2: `src/contexts/app.context.tsx` — Thêm Hàm `reset()`

```typescript
interface AppContextInterface {
  // ... các field cũ: isAuthenticated, setIsAuthenticated, profile, setProfile...
  reset: () => void                    // Hàm dọn sạch toàn bộ auth state
}

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  // ... các state cũ

  const reset = () => {
    setIsAuthenticated(false)
    setExtendedPurchases([])
    setProfile(null)
  }

  return (
    <AppContext.Provider
      value={{
        // ... các field cũ
        reset
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
```

### Tại sao gom thành hàm `reset()` thay vì gọi 3 setter riêng lẻ?

**Cách cũ** — gọi setter riêng lẻ ở NavHeader khi logout:

```typescript
// NavHeader.tsx
setIsAuthenticated(false)
setProfile(null)
// Quên setExtendedPurchases([]) → giỏ hàng vẫn còn dữ liệu cũ!
```

Vấn đề: nếu sau này thêm state mới (ví dụ `setUserNotifications([])`), phải nhớ thêm vào tất cả nơi gọi logout — dễ bỏ sót và sinh bug.

**Cách mới** — gom vào `reset()`:

```typescript
// Bất kỳ đâu cần reset:
reset()  // Một hàm, dọn sạch mọi thứ

// Khi thêm state mới, chỉ cần cập nhật hàm reset() ở một chỗ
const reset = () => {
  setIsAuthenticated(false)
  setExtendedPurchases([])
  setProfile(null)
  setUserNotifications([])  // ← Thêm ở đây, tự động áp dụng cho tất cả nơi gọi reset()
}
```

---

## File 3: `src/utils/http.ts` — Xử Lý Lỗi 401

```typescript
this.instance.interceptors.response.use(
  (response) => { /* ... xử lý thành công ... */ },
  function (error: AxiosError) {
    // Toast lỗi cho các lỗi KHÔNG PHẢI 422 (validation) — vì 422 được xử lý riêng bởi form
    if (error.response?.status !== HttpStatusCode.UnprocessableEntity) {
      const data: any | undefined = error.response?.data
      const message = data.message || error.message
      toast.error(message)
    }

    // Nếu là lỗi 401 (Unauthorized) → xóa token + phát event
    if (error.response?.status === HttpStatusCode.Unauthorized) {
      clearLS()    // Xóa localStorage + phát event 'clearLS'
    }

    return Promise.reject(error)
  }
)
```

**Luồng xử lý lỗi theo từng loại:**

```
API trả lỗi
    │
    ├── 422 (Unprocessable Entity)?
    │   └── KHÔNG toast — để form component tự hiển thị lỗi validation
    │
    ├── Các lỗi khác (400, 403, 500...)?
    │   └── Toast thông báo lỗi cho user
    │
    └── 401 (Unauthorized)?
        └── Toast lỗi + clearLS() → xóa token + phát event → App reset UI
```

Lưu ý: lỗi 401 vừa hiện toast VÀ xóa token — hai block `if` chạy **độc lập** (không phải `else if`).

---

## File 4: `src/main.tsx` — Thay Đổi `queryClient`

Trước đây `NavHeader` import `queryClient` trực tiếp từ `main.tsx`:

```typescript
// main.tsx — TRƯỚC
export const queryClient = new QueryClient(...)   // export ra ngoài

// NavHeader.tsx
import { queryClient } from '~/main'              // Import trực tiếp
queryClient.removeQueries(...)
```

**Vấn đề:** Import trực tiếp tạo **hard dependency** (phụ thuộc cứng) vào file `main.tsx` từ component `NavHeader` — component không nên biết về entry point của app. Điều này gây khó khăn khi viết unit test (phải mock cả `main.tsx`).

Giờ chuyển sang **hook chuẩn của React Query**:

```typescript
// main.tsx — SAU
const queryClient = new QueryClient(...)   // Không export nữa

// NavHeader.tsx
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()   // Lấy từ React Context, đúng pattern
```

`useQueryClient()` lấy `queryClient` từ React Context (được cung cấp bởi `<QueryClientProvider>`). Đây là **loose coupling** — component chỉ phụ thuộc vào hook interface, không phụ thuộc vào file cụ thể.

---

## File 5 & 6: Xóa `queryClient` Export + `NavHeader.tsx` Dùng `useQueryClient`

```typescript
// NavHeader.tsx — TRƯỚC
import { queryClient } from '~/main'

// NavHeader.tsx — SAU
import { useQueryClient } from '@tanstack/react-query'

export default function NavHeader() {
  const queryClient = useQueryClient()   // Lấy từ hook thay vì import trực tiếp
  // ...
}
```

---

## File 7: `src/App.tsx` — Lắng Nghe Event và Reset

```typescript
import { LocalStorageEventTarget } from '~/utils/auth'
import { useContext, useEffect } from 'react'
import { AppContext } from '~/contexts/app.context'

function App() {
  const routeElements = useRouteElements()
  const { reset } = useContext(AppContext)

  useEffect(() => {
    // Đăng ký lắng nghe event 'clearLS' trên LocalStorageEventTarget
    LocalStorageEventTarget.addEventListener('clearLS', reset)

    // Cleanup: hủy đăng ký khi App unmount (tránh memory leak)
    return () => {
      LocalStorageEventTarget.removeEventListener('clearLS', reset)
    }
  }, [reset])   // reset là stable function → dependency array không gây re-run liên tục

  return (
    <div>
      {routeElements}
      <ToastContainer />
    </div>
  )
}
```

### Tại sao đặt listener ở App?

`App` là component **gốc của ứng dụng**, tồn tại trong suốt vòng đời app. Đặt listener ở đây đảm bảo:
- Listener luôn hoạt động bất kể user đang ở trang nào
- Chỉ có một listener duy nhất (không bị duplicate)

Nếu đặt listener ở component con (ví dụ `NavHeader`), khi user navigate và component đó unmount → listener bị xóa → miss event.

---

## Luồng Hoạt Động Đầy Đủ (Token Hết Hạn)

```
1. User đăng nhập → state isAuthenticated=true, token lưu LS
       │
2. 1 giờ trôi qua → token hết hạn
       │
3. User bấm "Thêm vào giỏ"
       │
4. http.ts gửi request → Server trả 401 Unauthorized
       │
5. Response interceptor bắt lỗi 401:
   a) toast.error("...")          → User thấy thông báo lỗi
   b) clearLS():
      - Xóa access_token khỏi localStorage
      - Xóa profile khỏi localStorage
      - dispatchEvent(new Event('clearLS'))  → Phát tín hiệu
       │
6. App.tsx đang lắng nghe → bắt được event 'clearLS'
       │
7. Gọi reset():
   - setIsAuthenticated(false) → ProtectedRoute redirect về /login
   - setProfile(null)          → NavHeader ẩn avatar, hiện nút Đăng nhập
   - setExtendedPurchases([])  → Giỏ hàng xóa sạch
       │
8. UI tự động chuyển về trang Login ✅ (không cần F5)
```

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Custom EventTarget** | Tạo "đài phát thanh" tùy chỉnh bằng `new EventTarget()`. Dùng `dispatchEvent()` để phát tín hiệu và `addEventListener()` để lắng nghe. Giúp 2 module không liên quan nhau "nói chuyện" mà không cần import lẫn nhau. |
| **`window.storage` vs Custom Event** | `window.storage` chỉ phát khi **tab khác** thay đổi localStorage. Custom EventTarget phát trong **tab hiện tại** — đúng là thứ cần ở đây. |
| **`reset()` pattern** | Gom tất cả logic "dọn dẹp" vào một hàm duy nhất. Khi thêm state mới, chỉ cần cập nhật `reset()` ở một chỗ — tránh bỏ sót ở nhiều nơi gọi. |
| **`useQueryClient()` vs direct import** | Hook lấy queryClient từ React Context — loose coupling, dễ test. Import trực tiếp từ file tạo hard dependency — khó test, vi phạm nguyên tắc DI. |
| **401 Auto-logout** | Khi server trả Unauthorized, xóa token và phát event để reset toàn bộ UI về trạng thái chưa đăng nhập. User được tự động redirect về trang Login mà không cần reload trang. |
