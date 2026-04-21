# f08faf7 — feat: Thực hiện chức năng refresh token tự động

## Tổng Quan

Commit này triển khai cơ chế **Refresh Token tự động** trong Axios Interceptor. Đây là một trong những tính năng phức tạp nhất trong dự án, giải quyết vấn đề: access token hết hạn nhưng user đang trong phiên làm việc và không muốn bị đăng xuất.

---

## Bối Cảnh: Tại Sao Cần Refresh Token?

Modern authentication thường dùng **2 loại token**:

| Token | Thời hạn | Tác dụng |
|-------|---------|---------|
| `access_token` | Ngắn (1 giờ, 15 phút...) | Xác thực mọi API request |
| `refresh_token` | Dài (7 ngày, 30 ngày...) | Xin access token mới |

**Tại sao không dùng 1 token dài hạn?** Vì nếu token bị lộ, attacker có thể dùng mãi mãi. Token ngắn hạn giới hạn thiệt hại.

**Luồng không có Refresh Token (commit trước):**

```
1 giờ trôi qua → access_token hết hạn
User gọi API → 401 → clearLS() → đăng xuất
User bực bội: "Tại sao tôi phải đăng nhập lại?"
```

**Luồng có Refresh Token (sau commit này):**

```
1 giờ trôi qua → access_token hết hạn
User gọi API → 401 → tự động gọi API lấy access_token mới (dùng refresh_token)
→ Gọi lại API ban đầu với token mới
User không cần làm gì, không biết gì đã xảy ra ✅
```

---

## Thay Đổi Chính: `src/utils/http.ts`

### Cấu Trúc Interceptor Mới

```typescript
class Http {
  instance: AxiosInstance
  private access_token: string          // Cache token trong memory (nhanh hơn đọc LS)
  private refresh_token: string         // Cache refresh token
  private refreshTokenRequest: Promise<string> | null   // Promise sharing (key!)

  constructor() {
    this.access_token = getAccessTokenFromLS()
    this.refresh_token = getRefreshTokenFromLS()
    this.refreshTokenRequest = null

    this.instance = axios.create({ ... })

    this.instance.interceptors.request.use(...)    // Gắn token vào mỗi request
    this.instance.interceptors.response.use(...)   // Xử lý 401: refresh token
  }
}
```

---

## Thử Thách 1: Gọi API Refresh Nhiều Lần Đồng Thời

### Vấn đề này xảy ra khi nào?

Trong trang giỏ hàng, user mở trang và:
- `useQuery` A: gọi `GET /products` → 401 (token hết hạn)
- `useQuery` B: gọi `GET /purchases` → 401 (token hết hạn)
- `useQuery` C: gọi `GET /me` → 401 (token hết hạn)

3 request cùng thất bại cùng lúc → 3 lần thử refresh token → **server nhận 3 request `/refresh-token`** gần như đồng thời.

**Vấn đề:** Refresh token được thiết kế để **dùng một lần** (single-use). Khi request đầu tiên dùng refresh token thành công, server **tạo refresh token mới** và **invalidate refresh token cũ**. 2 request còn lại dùng refresh token cũ → thất bại → user bị đăng xuất thay vì được refresh.

### Giải Pháp: Promise Sharing

```typescript
private refreshTokenRequest: Promise<string> | null = null

// Trong response interceptor khi gặp 401:
this.access_token = ''
const config = error.response?.config

// Key kỹ thuật: Nếu đang có refreshTokenRequest đang chạy, DÙNG CHUNG nó
this.refreshTokenRequest = this.refreshTokenRequest ?? this.refreshToken().finally(() => {
  setTimeout(() => {
    this.refreshTokenRequest = null   // Xóa sau 10s để các request sau được phép refresh lại
  }, 10000)
})

// Chờ refresh xong → lấy access token mới → thử lại request ban đầu
return this.refreshTokenRequest.then((access_token) => {
  return this.instance({
    ...config,
    headers: { ...config?.headers, authorization: access_token }
  })
})
```

**Cơ chế hoạt động:**

```
Request A thất bại 401:
  refreshTokenRequest = null
  → refreshTokenRequest = this.refreshToken()   ← BẮT ĐẦU gọi API refresh

Request B thất bại 401 (0.002ms sau):
  refreshTokenRequest đang có giá trị (Promise đang chạy)
  → refreshTokenRequest = refreshTokenRequest   ← DÙNG CHUNG Promise cũ (không gọi API mới)

Request C thất bại 401 (0.005ms sau):
  → Tương tự, dùng chung cùng Promise

→ Server chỉ nhận 1 request refresh token ✅
```

**`??` (Nullish Coalescing Assignment):**

```typescript
this.refreshTokenRequest = this.refreshTokenRequest ?? this.refreshToken()
// Nếu refreshTokenRequest là null → gán = this.refreshToken() (tạo Promise mới)
// Nếu refreshTokenRequest đang có giá trị (Promise đang chạy) → giữ nguyên
```

**Tại sao xóa `refreshTokenRequest` sau 10s?**

`finally(() => setTimeout(() => { this.refreshTokenRequest = null }, 10000))`

Sau khi refresh xong, nếu `refreshTokenRequest` mãi mãi còn giá trị → các request sau (sau vài phút) khi token hết hạn lần nữa sẽ dùng lại Promise cũ đã resolve → không có token mới. Xóa sau 10s cho phép các lần refresh sau hoạt động bình thường.

---

## Thử Thách 2: Axios Interceptor Dùng Async/Await

### Vấn đề:

Axios request interceptor thường là hàm synchronous. Với refresh token, interceptor cần `await` API refresh token trước khi retry request. Nếu viết sai, `async/await` trong interceptor có thể không hoạt động như mong đợi.

### Hàm `refreshToken`:

```typescript
private refreshToken() {
  return this.instance
    .post<RefreshTokenReponse>(URL_REFRESH_TOKEN, {
      refresh_token: this.refresh_token
    })
    .then((res) => {
      const { access_token } = res.data.data
      setAccessTokenToLS(access_token)
      this.access_token = access_token     // Cập nhật cache trong memory
      return access_token                  // Trả Promise<string>
    })
    .catch((error) => {
      clearLS()                            // Không thể refresh → đăng xuất
      this.access_token = ''
      this.refresh_token = ''
      throw error
    })
}
```

Hàm trả về `Promise<string>` (access token mới). Khi nhiều request cùng `await this.refreshTokenRequest`, tất cả đều nhận cùng giá trị khi Promise resolve lần đầu.

---

## Thử Thách 3: Không Retry Request Refresh Token (Vòng Lặp Vô Tận)

```typescript
if (
  status === HttpStatusCode.Unauthorized &&
  url !== URL_REFRESH_TOKEN   // ← QUAN TRỌNG
) {
  // Retry với token mới
}
```

Nếu bản thân request refresh token cũng thất bại 401 (vì refresh token đã hết hạn), interceptor không được retry nó. Nếu retry → gọi `refreshToken()` lại → lại 401 → lại retry → **vòng lặp vô tận**.

Điều kiện `url !== URL_REFRESH_TOKEN` phá vỡ vòng lặp: khi request refresh token thất bại → rơi vào `else` → gọi `clearLS()` → đăng xuất.

---

## Response Interceptor Đầy Đủ

```typescript
this.instance.interceptors.response.use(
  // Thành công → trả về response bình thường
  (response) => {
    const { url } = response.config
    if (url === URL_LOGIN || url === URL_REGISTER) {
      const data = response.data as AuthResponse
      this.access_token = data.data.access_token
      this.refresh_token = data.data.refresh_token
      setAccessTokenToLS(this.access_token)
      setRefreshTokenToLS(this.refresh_token)
    } else if (url === URL_LOGOUT) {
      this.access_token = ''
      this.refresh_token = ''
      clearLS()
    }
    return response
  },

  // Thất bại → xử lý theo HTTP status
  async (error: AxiosError) => {
    // KHÔNG toast lỗi 401 và 422 (xử lý riêng)
    if (
      ![HttpStatusCode.UnprocessableEntity, HttpStatusCode.Unauthorized].includes(
        error.response?.status as number
      )
    ) {
      const data: any | undefined = error.response?.data
      const message = data?.message || error.message
      toast.error(message)
    }

    const { response } = error
    if (
      response?.status === HttpStatusCode.Unauthorized
    ) {
      const config = response?.config || { headers: {} }
      const { url } = config

      // Chỉ refresh nếu không phải request refresh_token chính nó
      if (url !== URL_REFRESH_TOKEN) {
        this.access_token = ''
        this.refreshTokenRequest = this.refreshTokenRequest ?? this.refreshToken().finally(() => {
          setTimeout(() => {
            this.refreshTokenRequest = null
          }, 10000)
        })
        return this.refreshTokenRequest.then((access_token) => {
          return this.instance({
            ...config,
            headers: { ...config.headers, authorization: access_token }
          })
        })
      }

      // Lỗi 401 từ chính request refresh_token → đăng xuất
      clearLS()
      this.access_token = ''
      this.refresh_token = ''
      LocalStorageEventTarget.dispatchEvent(new Event('clearLS'))
      toast.error(response?.data?.message || error.message)
    }

    return Promise.reject(error)
  }
)
```

---

## Luồng Hoạt Động Đầy Đủ

### Kịch bản: User đang dùng app, access_token hết hạn

```
Bước 1: 3 request gần như đồng thời bị 401
   GET /products → 401
   GET /purchases → 401
   GET /me → 401

Bước 2: Response interceptor bắt lỗi 401 cho request A (đầu tiên)
   refreshTokenRequest = null
   → refreshTokenRequest = refreshToken()  ← Tạo Promise mới, gọi API refresh

Bước 3: Response interceptor bắt lỗi 401 cho request B và C
   refreshTokenRequest đang có giá trị
   → Dùng chung Promise đang chạy

Bước 4: refreshToken() hoàn thành
   access_token mới = "eyJhbGc..." (chuỗi JWT mới)
   → Lưu vào localStorage + memory cache

Bước 5: 3 Promise cùng resolve với access_token mới
   Request A được retry với token mới
   Request B được retry với token mới
   Request C được retry với token mới

Bước 6: Cả 3 request thành công ✅
   User không biết gì đã xảy ra
```

---

## Các Hàm Util Mới Trong `auth.ts`

```typescript
export const getRefreshTokenFromLS = () => localStorage.getItem('refresh_token') || ''
export const setRefreshTokenToLS = (refresh_token: string) => localStorage.setItem('refresh_token', refresh_token)
```

Thêm hàm đọc/ghi `refresh_token` vào localStorage song song với `access_token`. Đặt trong `auth.ts` vì chúng liên quan đến authentication.

---

## Tóm Tắt 3 Thử Thách Và Giải Pháp

| Thử thách | Vấn đề | Giải pháp |
|-----------|---------|-----------|
| Nhiều request thất bại đồng thời | Nhiều request cùng refresh → server reject | Promise Sharing: `refreshTokenRequest` chia sẻ 1 Promise duy nhất |
| Refresh token hết hạn | Retry request refresh → vòng lặp vô tận | Check `url !== URL_REFRESH_TOKEN` để không retry |
| Lưu token hiệu quả | Đọc localStorage mỗi request → chậm | Cache trong memory (`this.access_token`) |

---

## Kiến Thức Mới

| Khái niệm | Giải thích |
|-----------|-----------|
| **Refresh Token Pattern** | Dùng 2 token: access (ngắn hạn) + refresh (dài hạn). Khi access hết hạn, dùng refresh để lấy access mới. User không bị đăng xuất dù access hết hạn. |
| **Promise Sharing** | Lưu Promise đang chạy vào biến (`refreshTokenRequest`). Nhiều consumer `await` cùng Promise đó thay vì mỗi người tự tạo request riêng. Giải quyết vấn đề concurrent identical requests. |
| **Axios Response Interceptor** | Middleware bắt tất cả response trước khi đến `.then()` của caller. Lỗi 401 được xử lý tập trung ở đây — retry với token mới mà caller không biết. |
| **`??` (Nullish Coalescing)** | `a ?? b` → dùng `b` chỉ khi `a` là `null` hoặc `undefined`. Khác `||` ở chỗ không fallback khi `a` là `0` hay `""`. |
| **Vòng lặp vô tận trong interceptor** | Khi interceptor xử lý lỗi bằng cách gọi API, và API đó cũng có thể lỗi → phải có điều kiện dừng. Check `url !== URL_REFRESH_TOKEN` là điều kiện dừng. |
| **In-memory cache** | Lưu token vào biến private của class (`this.access_token`) để đọc nhanh hơn localStorage. Đồng bộ bằng cách luôn cập nhật cả 2 khi token thay đổi. |
